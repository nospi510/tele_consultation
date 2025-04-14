from datetime import datetime
import subprocess
from flask import Blueprint, request, jsonify, Response
from flasgger import swag_from
from app.services.ollama_service import get_ai_diagnosis
import requests
import re
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, socketio
from app.models.live_session import LiveSession, session_broadcasters, session_participants
from app.models.user import User
from flask_socketio import emit, join_room, leave_room
import logging
from urllib.parse import urljoin
import redis

# Configuration des logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Connexion à Redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)

tnt_bp = Blueprint("tnt", __name__)

# Routes existantes
@tnt_bp.route("/advice", methods=["GET"])
@swag_from({
    'tags': ['TNT'],
    'summary': 'Obtenir des conseils médicaux pour un symptôme',
    'parameters': [{
        'name': 'symptom_id',
        'in': 'query',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {'description': 'Conseil médical récupéré', 'schema': {'type': 'object', 'properties': {'advice': {'type': 'string'}}}},
        '400': {'description': 'ID de symptôme invalide'}
    }
})
def get_medical_advice():
    symptom_id = request.args.get("symptom_id", type=int)
    if not symptom_id:
        return jsonify({"error": "ID de symptôme invalide."}), 400

    symptoms = {1: "Fièvre et toux", 2: "Maux de tête", 3: "Douleurs abdominales"}
    diagnosis = get_ai_diagnosis(symptoms.get(symptom_id, "Symptôme inconnu"))
    logger.info(f"Conseil médical généré pour symptom_id: {symptom_id}")
    return jsonify({"advice": diagnosis}), 200

@tnt_bp.route("/live-channels", methods=["GET"])
@swag_from({
    'tags': ['TNT'],
    'summary': 'Obtenir la liste des chaînes TV en direct',
    'responses': {
        '200': {'description': 'Liste des chaînes récupérée', 'schema': {'type': 'array', 'items': {'type': 'object', 'properties': {'name': {'type': 'string'}, 'url': {'type': 'string'}}}}},
        '500': {'description': 'Erreur lors de la récupération des chaînes'}
    }
})
def get_live_channels():
    try:
        #m3u_url = "https://iptv-org.github.io/iptv/countries/fr.m3u"
        m3u_url = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"

        response = requests.get(m3u_url, timeout=15)  # Timeout augmenté
        response.raise_for_status()

        m3u_content = response.text.splitlines()
        channels = []
        current_name = None
        for line in m3u_content:
            if line.startswith("#EXTINF"):
                match = re.search(r'tvg-name="([^"]+)"', line) or re.search(r',(.+)$', line)
                if match:
                    current_name = match.group(1).strip()
            elif line.startswith("http") and current_name:
                channels.append({"name": current_name, "url": line.strip()})
                current_name = None
        
        logger.info(f"{len(channels)} chaînes TV récupérées avec succès")
        return jsonify(channels), 200
    except requests.RequestException as e:
        logger.error(f"Erreur réseau lors de la récupération des chaînes : {str(e)}")
        return jsonify({"error": f"Erreur réseau : {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Erreur inattendue : {str(e)}")
        return jsonify({"error": f"Erreur : {str(e)}"}), 500


@tnt_bp.route("/live-channels/proxy/<path:url>", methods=["GET"])
@swag_from({
    'tags': ['TNT'],
    'summary': 'Proxy pour diffuser un flux vidéo en direct',
    'parameters': [
        {
            'name': 'url',
            'in': 'path',
            'required': True,
            'type': 'string',
            'description': 'URL du flux vidéo à diffuser'
        }
    ],
    'responses': {
        '200': {'description': 'Flux vidéo diffusé'},
        '500': {'description': 'Erreur lors de la diffusion du flux'}
    }
})
def proxy_channel(url):
    try:
        # Augmenter le timeout pour les requêtes HEAD et GET
        head_response = requests.head(url, timeout=10)
        content_type = head_response.headers.get('Content-Type', 'application/x-mpegURL')

        # Récupérer le contenu en streaming
        response = requests.get(url, stream=True, timeout=15)
        response.raise_for_status()

        # Si c'est un fichier M3U8, ajuster les URLs relatives
        if content_type == 'application/x-mpegURL' or url.endswith('.m3u8'):
            m3u_content = response.text
            base_url = url.rsplit('/', 1)[0] + '/'
            adjusted_m3u = []
            for line in m3u_content.splitlines():
                if line and not line.startswith('#') and not line.startswith('http'):
                    absolute_url = urljoin(base_url, line)
                    proxy_url = f"/api/tnt/live-channels/proxy/{absolute_url}"
                    adjusted_m3u.append(proxy_url)
                else:
                    adjusted_m3u.append(line)
            logger.info(f"Proxy M3U8 ajusté pour : {url}")
            return Response('\n'.join(adjusted_m3u), content_type=content_type)

        # Pour les fragments .ts, diffuser en streaming
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                yield chunk

        logger.info(f"Proxy démarré pour le flux : {url}")
        return Response(generate(), content_type=content_type)
    except requests.RequestException as e:
        logger.error(f"Erreur réseau dans le proxy pour {url} : {str(e)}")
        return jsonify({"error": f"Erreur réseau : {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Erreur inattendue dans le proxy pour {url} : {str(e)}")
        return jsonify({"error": f"Erreur : {str(e)}"}), 500
    

# Nouvelle route pour créer une session live
@tnt_bp.route("/live-session/create", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Créer une session live',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'title': {'type': 'string'}
            }
        }
    }],
    'responses': {
        '201': {'description': 'Session live créée'},
        '403': {'description': 'Seuls les docteurs peuvent créer une session'},
        '400': {'description': 'Erreur dans la requête'}
    }
})
def create_live_session():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role != "doctor":
        logger.warning(f"Tentative de création par non-docteur: {user.email}")
        return jsonify({"error": "Seuls les docteurs peuvent créer"}), 403

    data = request.get_json()
    if not data.get("title"):
        return jsonify({"error": "Titre requis"}), 400

    new_session = LiveSession(title=data["title"], host_doctor_id=user_id, is_active=True)
    db.session.add(new_session)
    db.session.commit()

    db.session.execute(session_broadcasters.insert().values(session_id=new_session.id, user_id=user_id))
    db.session.commit()

    logger.info(f"Session créée: {new_session.title} par {user.email}")
    socketio.emit('new_session', {'id': new_session.id, 'title': new_session.title, 'host': user.fullname}, namespace='/live')
    return jsonify({"message": "Session créée", "session_id": new_session.id}), 201


# Rejoindre une session comme broadcaster
@tnt_bp.route("/live-session/join-as-broadcaster", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Rejoindre une session comme diffuseur',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'session_id': {'type': 'integer'}
            }
        }
    }],
    'responses': {
        '200': {'description': 'Ajouté comme diffuseur'},
        '403': {'description': 'Seuls les docteurs peuvent diffuser'},
        '404': {'description': 'Session non trouvée'}
    }
})
def join_as_broadcaster():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role != "doctor":
        logger.warning(f"Tentative de diffusion par non-docteur: {user.email}")
        return jsonify({"error": "Seuls les docteurs peuvent diffuser"}), 403

    data = request.get_json()
    session = LiveSession.query.get(data["session_id"])
    if not session:
        return jsonify({"error": "Session non trouvée"}), 404

    db.session.execute(session_broadcasters.insert().values(session_id=session.id, user_id=user_id))
    db.session.commit()

    logger.info(f"{user.email} a rejoint {session.title} comme diffuseur")
    socketio.emit('broadcaster_joined', {'session_id': session.id, 'user': user.fullname}, room=str(session.id), namespace='/live')
    return jsonify({"message": "Ajouté comme diffuseur"}), 200


# Liste des sessions live avec redis
@tnt_bp.route("/live-session/list", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Lister les sessions live actives',
    'security': [{'BearerAuth': []}],
    'responses': {
        '200': {
            'description': 'Liste des sessions',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'title': {'type': 'string'},
                        'host': {'type': 'string'},
                        'broadcasters': {'type': 'array', 'items': {'type': 'string'}}
                    }
                }
            }
        }
    }
})
def list_live_sessions():
    sessions = LiveSession.query.filter_by(is_active=True).all()
    result = []
    for s in sessions:
        data = redis_client.hgetall(f"live_session:{s.id}")
        hls_url = data.get(b"hls_url", b"").decode() if data else ""
        result.append({
            'id': s.id,
            'title': s.title,
            'host': s.host.fullname,
            'broadcasters': [b.fullname for b in s.broadcasters],
            'hls_url': hls_url
        })
    logger.info("Liste des sessions live demandée")
    return jsonify(result), 200



# Nouvelle route pour stocker l’URL HLS dans Redis
@tnt_bp.route("/live-session/broadcast-url", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Stocker l’URL HLS d’une session live',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'session_id': {'type': 'integer'},
                'hls_url': {'type': 'string'}
            }
        }
    }],
    'responses': {
        '200': {'description': 'URL HLS stockée'},
        '400': {'description': 'Données manquantes'}
    }
})
def store_broadcast_url():
    user_id = get_jwt_identity()
    data = request.get_json()
    session_id = data.get("session_id")
    hls_url = data.get("hls_url")
    if not session_id or not hls_url:
        return jsonify({"error": "Session ID ou URL HLS manquant"}), 400
    redis_client.hset(f"live_session:{session_id}", mapping={"user_id": user_id, "hls_url": hls_url})
    logger.info(f"URL HLS stockée pour session {session_id}: {hls_url}")
    return jsonify({"message": "URL HLS stockée", "session_id": session_id}), 200


# Nouvelle route pour récupérer l’URL HLS
@tnt_bp.route("/live-session/<int:session_id>/url", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Récupérer l’URL HLS d’une session live',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {'description': 'URL HLS récupérée', 'schema': {'type': 'object', 'properties': {'user_id': {'type': 'string'}, 'hls_url': {'type': 'string'}}}},
        '404': {'description': 'Session non trouvée'}
    }
})
def get_broadcast_url(session_id):
    data = redis_client.hgetall(f"live_session:{session_id}")
    if not data:
        return jsonify({"error": "Aucune diffusion en cours"}), 404
    return jsonify({"user_id": data[b"user_id"].decode(), "hls_url": data[b"hls_url"].decode()}), 200

@tnt_bp.route("/live-session/start-broadcast", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Démarrer une diffusion WebRTC vers SRS',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'session_id': {'type': 'integer'}
            }
        }
    }],
    'responses': {
        '200': {'description': 'Diffusion démarrée'},
        '400': {'description': 'Session ID manquant'}
    }
})
def start_broadcast():
    user_id = get_jwt_identity()
    data = request.get_json()
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Session ID manquant"}), 400

    hls_url = f"http://localhost:8080/hls/live/{session_id}_{user_id}.m3u8"
    redis_client.hset(f"live_session:{session_id}", mapping={"user_id": user_id, "hls_url": hls_url})
    socketio.emit('broadcast_started', {'user_id': user_id}, room=str(session_id), namespace='/live')
    logger.info(f"Diffusion WebRTC démarrée pour session {session_id} par {user_id}")
    return jsonify({"message": "Diffusion démarrée", "hls_url": hls_url}), 200



# Gestion WebSocket
@socketio.on('connect', namespace='/live')
def handle_connect():
    logger.info("Client connecté au namespace /live")

@socketio.on('disconnect', namespace='/live')
def handle_disconnect():
    logger.info("Client déconnecté du namespace /live")

@socketio.on('join_session', namespace='/live')
def on_join_session(data):
    session_id = data['session_id']
    user_id = data['user_id']
    join_room(str(session_id))
    logger.info(f"Utilisateur {user_id} a rejoint la session {session_id}")
    emit('user_joined', {'user_id': user_id}, room=str(session_id))

@socketio.on('leave_session', namespace='/live')
def on_leave_session(data):
    session_id = data['session_id']
    user_id = data['user_id']
    leave_room(str(session_id))
    logger.info(f"Utilisateur {user_id} a quitté la session {session_id}")
    emit('user_left', {'user_id': user_id}, room=str(session_id))

@socketio.on('send_comment', namespace='/live')
def on_send_comment(data):
    session_id = data['session_id']
    user_id = data['user_id']
    comment = data['comment']
    user = User.query.get(user_id)
    logger.info(f"Commentaire dans {session_id} par {user.email}: {comment}")
    emit('new_comment', {'user': user.fullname, 'comment': comment, 'timestamp': datetime.utcnow().isoformat()}, room=str(session_id))

@socketio.on('start_broadcast', namespace='/live')
def on_start_broadcast(data):
    session_id = data['session_id']
    user_id = data['user_id']
    logger.info(f"Diffusion démarrée dans {session_id} par {user_id}")
    emit('broadcast_started', {'user_id': user_id}, room=str(session_id))