from datetime import datetime
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

# Configuration des logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        m3u_url = "https://iptv-org.github.io/iptv/languages/fra.m3u"
        response = requests.get(m3u_url)
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
        logger.info("Liste des chaînes TV récupérée avec succès")
        return jsonify(channels), 200
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des chaînes : {str(e)}")
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
        # Faire une requête HEAD pour vérifier le type de contenu
        head_response = requests.head(url, timeout=5)
        content_type = head_response.headers.get('Content-Type', 'application/x-mpegURL')

        # Récupérer le manifeste M3U8
        response = requests.get(url, stream=True, timeout=10)
        response.raise_for_status()

        # Si c'est un fichier M3U8, ajuster les URLs relatives
        if content_type == 'application/x-mpegURL' or url.endswith('.m3u8'):
            m3u_content = response.text
            # Remplacer les URLs relatives par des URLs absolues via le proxy
            base_url = url.rsplit('/', 1)[0] + '/'  # URL de base du manifeste
            adjusted_m3u = []
            for line in m3u_content.splitlines():
                if line and not line.startswith('#') and not line.startswith('http'):
                    # URL relative, la transformer en absolue
                    absolute_url = urljoin(base_url, line)
                    # Rediriger via le proxy
                    proxy_url = f"/api/tnt/live-channels/proxy/{absolute_url}"
                    adjusted_m3u.append(proxy_url)
                else:
                    adjusted_m3u.append(line)
            
            # Retourner le manifeste ajusté
            logger.info(f"Proxy démarré pour le flux M3U8 ajusté : {url}")
            return Response('\n'.join(adjusted_m3u), content_type=content_type)
        
        # Sinon, diffuser le flux brut (pour les segments .ts)
        def generate():
            for chunk in response.iter_content(chunk_size=8192):
                yield chunk

        logger.info(f"Proxy démarré pour le flux : {url}")
        return Response(generate(), content_type=content_type)
    except requests.RequestException as e:
        logger.error(f"Erreur réseau dans le proxy : {str(e)}")
        return jsonify({"error": f"Erreur réseau : {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Erreur inattendue dans le proxy : {str(e)}")
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
        logger.warning(f"Tentative de création de session par non-docteur: {user.email}")
        return jsonify({"error": "Seuls les docteurs peuvent créer une session"}), 403

    data = request.get_json()
    if not data.get("title"):
        return jsonify({"error": "Titre requis"}), 400

    new_session = LiveSession(
        title=data["title"],
        host_doctor_id=user_id,
        is_active=True
    )
    db.session.add(new_session)
    db.session.commit()

    # Ajouter le créateur comme broadcaster
    db.session.execute(session_broadcasters.insert().values(session_id=new_session.id, user_id=user_id))
    db.session.commit()

    logger.info(f"Session live créée: {new_session.title} par {user.email}")
    socketio.emit('new_session', {
        'id': new_session.id,
        'title': new_session.title,
        'host': user.fullname
    }, namespace='/live')
    
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
    socketio.emit('broadcaster_joined', {
        'session_id': session.id,
        'user': user.fullname
    }, room=str(session.id), namespace='/live')
    
    return jsonify({"message": "Ajouté comme diffuseur"}), 200

# Liste des sessions live
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
    result = [{
        'id': s.id,
        'title': s.title,
        'host': s.host.fullname,
        'broadcasters': [b.fullname for b in s.broadcasters]
    } for s in sessions]
    
    logger.info("Liste des sessions live demandée")
    return jsonify(result), 200

# Gestion WebSocket
@socketio.on('connect', namespace='/live')
def handle_connect():
    logger.info("Client connecté au namespace /live")

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
    logger.info(f"Commentaire envoyé dans {session_id} par {user.email}: {comment}")
    emit('new_comment', {
        'user': user.fullname,
        'comment': comment,
        'timestamp': datetime.utcnow().isoformat()
    }, room=str(session_id))

@socketio.on('start_broadcast', namespace='/live')
def on_start_broadcast(data):
    session_id = data['session_id']
    user_id = data['user_id']
    logger.info(f"Diffusion démarrée dans {session_id} par {user_id}")
    emit('broadcast_started', {'user_id': user_id}, room=str(session_id))