from datetime import datetime, timedelta
import subprocess
from flask import Blueprint, request, jsonify, Response, render_template, redirect, url_for, session
from flasgger import swag_from
from app.services.ollama_service import get_ai_diagnosis
import requests
import re
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, socketio
from app.models.live_session import LiveSession, session_broadcasters, session_participants, LiveQuestion, VideoQueue, LiveQuiz, QuizAnswer
from app.models.user import User
from flask_socketio import emit, join_room, leave_room
import logging
from urllib.parse import urljoin
import redis
import uuid

# Configuration des logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Connexion à Redis
redis_client = redis.Redis(host='192.168.1.42', port=6379, db=0)

tnt_bp = Blueprint("tnt", __name__)

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
        m3u_url = "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
        response = requests.get(m3u_url, timeout=15)
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
    'parameters': [{
        'name': 'url',
        'in': 'path',
        'required': True,
        'type': 'string',
        'description': 'URL du flux vidéo à diffuser'
    }],
    'responses': {
        '200': {'description': 'Flux vidéo diffusé'},
        '500': {'description': 'Erreur lors de la diffusion du flux'}
    }
})
def proxy_channel(url):
    try:
        head_response = requests.head(url, timeout=10)
        content_type = head_response.headers.get('Content-Type', 'application/x-mpegURL')
        response = requests.get(url, stream=True, timeout=15)
        response.raise_for_status()

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

@tnt_bp.route("/live-session/create", methods=["GET", "POST"])
def create_live_session():
    """Affiche la page de création ou crée une session live"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    if user.role != "doctor":
        logger.warning(f"Tentative de création par non-docteur: {user.email}")
        return render_template("tnt/create_session.html", error="Seuls les docteurs peuvent créer", user=user), 403

    if request.method == "GET":
        return render_template("tnt/create_session.html", user=user)

    if request.content_type == "application/json":
        data = request.get_json()
        if not data.get("title"):
            return jsonify({"error": "Titre requis"}), 400
    else:
        data = request.form
        if not data.get("title"):
            return render_template("tnt/create_session.html", error="Titre requis", user=user), 400

    new_session = LiveSession(title=data["title"], host_doctor_id=user_id, is_active=True)
    db.session.add(new_session)
    db.session.commit()

    db.session.execute(session_broadcasters.insert().values(session_id=new_session.id, user_id=user_id))
    db.session.commit()

    logger.info(f"Session créée: {new_session.title} par {user.email}")
    socketio.emit('new_session', {'id': new_session.id, 'title': new_session.title, 'host': user.fullname}, namespace='/live')
    if request.content_type == "application/json":
        return jsonify({"message": "Session créée", "session_id": new_session.id}), 201
    return redirect(url_for("tnt.list_live_sessions"))

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
        'schema': {'type': 'object', 'properties': {'session_id': {'type': 'integer'}}}
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
    socketio.emit('broadcaster_joined', {'session_id': session.id, 'user_id': user_id, 'user': user.fullname}, room=str(session.id), namespace='/live')
    return jsonify({"message": "Ajouté comme diffuseur"}), 200

@tnt_bp.route("/live-session/list", methods=["GET"])
def list_live_sessions():
    """Affiche la liste des sessions live ou retourne JSON pour l'API"""
    user_id = session.get("user_id")
    if not user_id and not request.headers.get('Authorization'):
        return redirect(url_for('auth.login'))

    sessions = LiveSession.query.filter_by(is_active=True).all()
    result = []
    for s in sessions:
        hls_urls = []
        for broadcaster in s.broadcasters:
            data = redis_client.hgetall(f"live_session:{s.id}:{broadcaster.id}")
            if data and b"hls_url" in data:
                hls_urls.append(data[b"hls_url"].decode())
        result.append({
            'id': s.id,
            'title': s.title,
            'host': s.host.fullname,
            'broadcasters': [b.fullname for b in s.broadcasters],
            'hls_urls': hls_urls
        })

    if request.headers.get('Authorization'):
        logger.info("Liste des sessions live demandée via API")
        return jsonify(result), 200

    user = User.query.get(user_id)
    logger.info("Liste des sessions live affichée")
    return render_template("tnt/live_sessions.html", sessions=result, user=user)

@tnt_bp.route("/live-session/<int:session_id>", methods=["GET"])
def live_session_detail(session_id):
    """Affiche les détails d'une session live"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    if not live_session:
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user), 404

    hls_urls = []
    for broadcaster in live_session.broadcasters:
        data = redis_client.hgetall(f"live_session:{session_id}:{broadcaster.id}")
        if data and b"hls_url" in data:
            hls_urls.append({
                "user_id": data[b"user_id"].decode(),
                "hls_url": data[b"hls_url"].decode()
            })
    print(f"hls_urls: {hls_urls}")  # Log pour diagnostic

    questions = LiveQuestion.query.filter_by(session_id=session_id).order_by(LiveQuestion.created_at.asc()).all()
    question_data = [{
        'id': q.id,
        'user': q.user.fullname,
        'question_text': q.question_text,
        'answer_text': q.answer_text,
        'timestamp': q.created_at.isoformat()
    } for q in questions]

    video_queue = VideoQueue.query.filter_by(session_id=session_id, status='waiting').order_by(VideoQueue.position.asc()).all()
    queue_data = [{
        'user_id': q.user_id,
        'user': q.user.fullname,
        'position': q.position
    } for q in video_queue]

    quizzes = LiveQuiz.query.filter_by(session_id=session_id).order_by(LiveQuiz.created_at.desc()).all()
    quiz_data = [{
        'quiz_id': quiz.id,
        'question': quiz.question,
        'options': quiz.options,
        'duration': quiz.duration,
        'created_at': quiz.created_at.isoformat()
    } for quiz in quizzes]

    questions_enabled = redis_client.get(f"live_session:{session_id}:questions_enabled") == b"true"
    is_broadcaster = user_id in [b.id for b in live_session.broadcasters]

    return render_template("tnt/live_session_detail.html", 
                          session=live_session, 
                          hls_urls=hls_urls, 
                          questions=question_data, 
                          video_queue=queue_data, 
                          quizzes=quiz_data,  # Ajout des quiz
                          questions_enabled=questions_enabled, 
                          is_broadcaster=is_broadcaster, 
                          user=user)

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
        'schema': {'type': 'object', 'properties': {'session_id': {'type': 'integer'}, 'hls_url': {'type': 'string'}}}
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
    redis_client.hset(f"live_session:{session_id}:{user_id}", mapping={"user_id": user_id, "hls_url": hls_url})
    logger.info(f"URL HLS stockée pour session {session_id}, user {user_id}: {hls_url}")
    return jsonify({"message": "URL HLS stockée", "session_id": session_id}), 200

@tnt_bp.route("/live-session/<int:session_id>/url", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Récupérer les URLs HLS d’une session live',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {
            'description': 'URLs HLS récupérées',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'user_id': {'type': 'string'},
                        'hls_url': {'type': 'string'}
                    }
                }
            }
        },
        '404': {'description': 'Session non trouvée'}
    }
})
def get_broadcast_url(session_id):
    session = LiveSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session non trouvée"}), 404
    hls_urls = []
    for broadcaster in session.broadcasters:
        data = redis_client.hgetall(f"live_session:{session_id}:{broadcaster.id}")
        if data and b"hls_url" in data:
            hls_urls.append({
                "user_id": data[b"user_id"].decode(),
                "hls_url": data[b"hls_url"].decode()
            })
    if not hls_urls:
        return jsonify({"error": "Aucune diffusion en cours"}), 404
    return jsonify(hls_urls), 200

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
        'schema': {'type': 'object', 'properties': {'session_id': {'type': 'integer'}}}
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
    redis_client.hset(f"live_session:{session_id}:{user_id}", mapping={"user_id": user_id, "hls_url": hls_url})
    socketio.emit('broadcast_started', {'user_id': user_id, 'hls_url': hls_url}, room=str(session_id), namespace='/live')
    logger.info(f"Diffusion WebRTC démarrée pour session {session_id} par {user_id}")
    return jsonify({"message": "Diffusion démarrée", "hls_url": hls_url}), 200

@tnt_bp.route("/live-session/<int:session_id>/questions/enable", methods=["POST"])
@jwt_required()
def enable_questions(session_id):
    user_id = get_jwt_identity() if request.content_type == "application/json" else session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        if request.content_type == "application/json":
            return jsonify({"error": "Session non trouvée"}), 404
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user, session=live_session), 404
    
    # Autoriser si doctor OU diffuseur
    if user.role != "doctor" and user_id not in [b.id for b in live_session.broadcasters]:
        logger.warning(f"Tentative non autorisée d'activer les questions par {user.email}")
        if request.content_type == "application/json":
            return jsonify({"error": "Action réservée aux diffuseurs ou docteurs"}), 403
        return render_template("tnt/live_session_detail.html", error="Action réservée aux diffuseurs ou docteurs", user=user, session=live_session), 403

    redis_client.set(f"live_session:{session_id}:questions_enabled", "true")
    socketio.emit('questions_enabled', {'session_id': session_id}, room=str(session_id), namespace='/live')
    logger.info(f"Questions activées pour la session {session_id} par {user.email}")
    if request.content_type == "application/json":
        return jsonify({"message": "Questions activées"}), 200
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))

@tnt_bp.route("/live-session/<int:session_id>/questions/disable", methods=["POST"])
@jwt_required()
def disable_questions(session_id):
    user_id = get_jwt_identity() if request.content_type == "application/json" else session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        if request.content_type == "application/json":
            return jsonify({"error": "Session non trouvée"}), 404
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user, session=live_session), 404
    
    # Autoriser si doctor OU diffuseur
    if user.role != "doctor" and user_id not in [b.id for b in live_session.broadcasters]:
        logger.warning(f"Tentative non autorisée de désactiver les questions par {user.email}")
        if request.content_type == "application/json":
            return jsonify({"error": "Action réservée aux diffuseurs ou docteurs"}), 403
        return render_template("tnt/live_session_detail.html", error="Action réservée aux diffuseurs ou docteurs", user=user, session=live_session), 403

    redis_client.set(f"live_session:{session_id}:questions_enabled", "false")
    socketio.emit('questions_disabled', {'session_id': session_id}, room=str(session_id), namespace='/live')
    logger.info(f"Questions désactivées pour la session {session_id} par {user.email}")
    if request.content_type == "application/json":
        return jsonify({"message": "Questions désactivées"}), 200
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))


@tnt_bp.route("/live-session/<int:session_id>/questions", methods=["POST"])
def send_question(session_id):
    """Envoyer une question textuelle pour une session live ou via formulaire"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        return jsonify({"error": "Session non trouvée"}), 404
    if redis_client.get(f"live_session:{session_id}:questions_enabled") != b"true":
        return render_template("tnt/live_session_detail.html", error="Les questions ne sont pas activées", user=user, session=live_session), 400

    if request.content_type == "application/json":
        data = request.get_json()
        question_text = data.get("question_text")
        if not question_text:
            return jsonify({"error": "Texte de la question requis"}), 400
    else:
        data = request.form
        question_text = data.get("question_text")
        if not question_text:
            return render_template("tnt/live_session_detail.html", error="Texte de la question requis", user=user, session=live_session), 400

    new_question = LiveQuestion(
        session_id=session_id,
        user_id=user_id,
        question_text=question_text
    )
    db.session.add(new_question)
    db.session.commit()

    socketio.emit('new_question', {
        'id': new_question.id,
        'session_id': session_id,
        'user': user.fullname,
        'question_text': question_text,
        'timestamp': new_question.created_at.isoformat()
    }, room=str(session_id), namespace='/live')
    logger.info(f"Question envoyée pour la session {session_id} par {user.email}: {question_text}")
    if request.content_type == "application/json":
        return jsonify({"message": "Question envoyée", "question_id": new_question.id}), 201
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))

@tnt_bp.route("/live-session/<int:session_id>/questions/<int:question_id>/answer", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Répondre à une question textuelle',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }, {
        'name': 'question_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }, {
        'name': 'body',
        'in': 'body',
        'required': True,
        'schema': {'type': 'object', 'properties': {'answer_text': {'type': 'string'}}}
    }],
    'responses': {
        '200': {'description': 'Réponse envoyée'},
        '400': {'description': 'Texte de la réponse manquant'},
        '403': {'description': 'Seuls les diffuseurs peuvent répondre'},
        '404': {'description': 'Session ou question non trouvée'}
    }
})
def answer_question(session_id, question_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    session = LiveSession.query.get(session_id)
    question = LiveQuestion.query.get(question_id)
    
    if not session or not question:
        return jsonify({"error": "Session ou question non trouvée"}), 404
    if user.role != "doctor" and user_id not in [b.id for b in session.broadcasters]:
        logger.warning(f"Tentative non autorisée de répondre par {user.email}")
        return jsonify({"error": "Seuls les diffuseurs ou docteurs peuvent répondre"}), 403

    data = request.get_json()
    answer_text = data.get("answer_text")
    if not answer_text:
        return jsonify({"error": "Texte de la réponse requis"}), 400

    question.answer_text = answer_text
    question.answered_at = datetime.utcnow()
    db.session.commit()

    socketio.emit('new_answer', {
        'question_id': question.id,
        'session_id': session_id,
        'user': user.fullname,
        'answer_text': answer_text,
        'timestamp': question.answered_at.isoformat()
    }, room=str(session_id), namespace='/live')
    logger.info(f"Réponse envoyée pour la question {question_id} par {user.email}")
    return jsonify({"message": "Réponse envoyée"}), 200

@tnt_bp.route("/live-session/<int:session_id>/questions", methods=["GET"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Récupérer les questions et réponses d’une session live',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {
            'description': 'Liste des questions et réponses',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'user': {'type': 'string'},
                        'question_text': {'type': 'string'},
                        'answer_text': {'type': 'string'},
                        'timestamp': {'type': 'string'}
                    }
                }
            }
        },
        '404': {'description': 'Session non trouvée'}
    }
})
def get_questions(session_id):
    session = LiveSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session non trouvée"}), 404

    questions = LiveQuestion.query.filter_by(session_id=session_id).order_by(LiveQuestion.created_at.asc()).all()
    result = [{
        'id': q.id,
        'user': q.user.fullname,
        'question_text': q.question_text,
        'answer_text': q.answer_text,
        'timestamp': q.created_at.isoformat()
    } for q in questions]
    logger.info(f"Questions récupérées pour la session {session_id}")
    return jsonify(result), 200

@tnt_bp.route("/live-session/<int:session_id>/video-queue/join", methods=["POST"])
@jwt_required()
def join_video_queue(session_id):
    """Rejoindre la file d’attente vidéo via formulaire ou API"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user), 404
    
    existing_entry = VideoQueue.query.filter_by(session_id=session_id, user_id=user_id, status='waiting').first()
    if existing_entry:
        return render_template("tnt/live_session_detail.html", error="Vous êtes déjà dans la file d’attente", user=user, session=live_session), 400

    last_entry = VideoQueue.query.filter_by(session_id=session_id).order_by(VideoQueue.position.desc()).first()
    position = (last_entry.position + 1) if last_entry else 1

    new_entry = VideoQueue(
        session_id=session_id,
        user_id=user_id,
        position=position,
        status='waiting'
    )
    db.session.add(new_entry)
    db.session.commit()

    redis_client.rpush(f"live_session:{session_id}:video_queue", user_id)
    socketio.emit('video_queue_update', {
        'session_id': session_id,
        'user_id': user_id,
        'user': user.fullname,
        'position': position,
        'action': 'join'
    }, room=str(session_id), namespace='/live')
    logger.info(f"{user.email} a rejoint la file vidéo pour la session {session_id}")
    if request.content_type == "application/json":
        return jsonify({"message": "Ajouté à la file d’attente", "position": position}), 200
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))

@tnt_bp.route("/live-session/<int:session_id>/video-queue/leave", methods=["POST"])
@jwt_required()
def leave_video_queue(session_id):
    """Quitter la file d’attente vidéo via formulaire ou API"""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user), 404
    
    entry = VideoQueue.query.filter_by(session_id=session_id, user_id=user_id, status='waiting').first()
    if not entry:
        return render_template("tnt/live_session_detail.html", error="Vous n’êtes pas dans la file d’attente", user=user, session=live_session), 404

    entry.status = 'ended'
    db.session.commit()

    redis_client.lrem(f"live_session:{session_id}:video_queue", 0, user_id)
    socketio.emit('video_queue_update', {
        'session_id': session_id,
        'user_id': user_id,
        'user': user.fullname,
        'action': 'leave'
    }, room=str(session_id), namespace='/live')
    
    update_video_queue_positions(session_id)
    logger.info(f"{user.email} a quitté la file vidéo pour la session {session_id}")
    if request.content_type == "application/json":
        return jsonify({"message": "Sorti de la file d’attente"}), 200
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))

@tnt_bp.route("/live-session/<int:session_id>/video-queue/next", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Passer au prochain utilisateur dans la file vidéo',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {'description': 'Prochain utilisateur activé', 'schema': {'type': 'object', 'properties': {'user_id': {'type': 'integer'}, 'hls_url': {'type': 'string'}}}},
        '400': {'description': 'Aucun utilisateur dans la file'},
        '403': {'description': 'Seuls les diffuseurs peuvent passer au suivant'},
        '404': {'description': 'Session non trouvée'}
    }
})
def next_video_queue(session_id):
    # Vérification pour requêtes API (JWT)
    if request.content_type == "application/json":
        user_id = get_jwt_identity()
    else:
        # Vérification pour formulaires HTML (session)
        user_id = session.get("user_id")
        if not user_id:
            return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        if request.content_type == "application/json":
            return jsonify({"error": "Session non trouvée"}), 404
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user, session=live_session), 404
    
    if user.role != "doctor" and user_id not in [b.id for b in live_session.broadcasters]:
        logger.warning(f"Tentative non autorisée de passer au suivant par {user.email}")
        if request.content_type == "application/json":
            return jsonify({"error": "Seuls les diffuseurs peuvent passer au suivant"}), 403
        return render_template("tnt/live_session_detail.html", error="Seuls les diffuseurs peuvent passer au suivant", user=user, session=live_session), 403

    current_active = VideoQueue.query.filter_by(session_id=session_id, status='active').first()
    if current_active:
        current_active.status = 'ended'
        db.session.commit()

    next_entry = VideoQueue.query.filter_by(session_id=session_id, status='waiting').order_by(VideoQueue.position.asc()).first()
    if not next_entry:
        hls_url = redis_client.hget(f"live_session:{session_id}:{live_session.host_doctor_id}", "hls_url")
        if hls_url:
            socketio.emit('video_stream_switch', {
                'session_id': session_id,
                'user_id': live_session.host_doctor_id,
                'hls_url': hls_url.decode(),
                'is_broadcaster': True
            }, room=str(session_id), namespace='/live')
            logger.info(f"Retour au flux du diffuseur pour la session {session_id}")
            if request.content_type == "application/json":
                return jsonify({"message": "Aucun utilisateur dans la file, retour au diffuseur", "hls_url": hls_url.decode()}), 200
            return redirect(url_for("tnt.live_session_detail", session_id=session_id))
        if request.content_type == "application/json":
            return jsonify({"error": "Aucun utilisateur dans la file et aucun flux diffuseur disponible"}), 400
        return render_template("tnt/live_session_detail.html", error="Aucun utilisateur dans la file et aucun flux diffuseur disponible", user=user, session=live_session), 400

    next_entry.status = 'active'
    db.session.commit()

    hls_url = f"http://localhost:8080/hls/live/{session_id}_{next_entry.user_id}.m3u8"
    redis_client.hset(f"live_session:{session_id}:{next_entry.user_id}", mapping={"user_id": next_entry.user_id, "hls_url": hls_url})

    redis_client.lrem(f"live_session:{session_id}:video_queue", 0, next_entry.user_id)
    
    update_video_queue_positions(session_id)

    socketio.emit('video_stream_switch', {
        'session_id': session_id,
        'user_id': next_entry.user_id,
        'hls_url': hls_url,
        'is_broadcaster': False
    }, room=str(session_id), namespace='/live')
    logger.info(f"Prochain utilisateur activé pour la session {session_id}: {next_entry.user_id}")
    if request.content_type == "application/json":
        return jsonify({"message": "Prochain utilisateur activé", "user_id": next_entry.user_id, "hls_url": hls_url}), 200
    return redirect(url_for("tnt.live_session_detail", session_id=session_id))

@tnt_bp.route("/live-session/<int:session_id>/video-queue/kick", methods=["POST"])
@jwt_required()
@swag_from({
    'tags': ['TNT'],
    'summary': 'Couper l’utilisateur actif de la file vidéo',
    'security': [{'BearerAuth': []}],
    'parameters': [{
        'name': 'session_id',
        'in': 'path',
        'required': True,
        'type': 'integer'
    }],
    'responses': {
        '200': {'description': 'Utilisateur coupé'},
        '403': {'description': 'Seuls les diffuseurs peuvent couper'},
        '404': {'description': 'Session ou utilisateur actif non trouvé'}
    }
})
def kick_video_queue(session_id):
    # Vérification pour requêtes API (JWT)
    if request.content_type == "application/json":
        user_id = get_jwt_identity()
    else:
        # Vérification pour formulaires HTML (session)
        user_id = session.get("user_id")
        if not user_id:
            return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    live_session = LiveSession.query.get(session_id)
    
    if not live_session:
        if request.content_type == "application/json":
            return jsonify({"error": "Session non trouvée"}), 404
        return render_template("tnt/live_session_detail.html", error="Session non trouvée", user=user, session=live_session), 404
    
    if user.role != "doctor" and user_id not in [b.id for b in live_session.broadcasters]:
        logger.warning(f"Tentative non autorisée de couper par {user.email}")
        if request.content_type == "application/json":
            return jsonify({"error": "Seuls les diffuseurs peuvent couper"}), 403
        return render_template("tnt/live_session_detail.html", error="Seuls les diffuseurs peuvent couper", user=user, session=live_session), 403

    active_entry = VideoQueue.query.filter_by(session_id=session_id, status='active').first()
    if not active_entry:
        if request.content_type == "application/json":
            return jsonify({"error": "Aucun utilisateur actif"}), 404
        return render_template("tnt/live_session_detail.html", error="Aucun utilisateur actif", user=user, session=live_session), 404

    active_entry.status = 'ended'
    db.session.commit()

    hls_url = redis_client.hget(f"live_session:{session_id}:{live_session.host_doctor_id}", "hls_url")
    if hls_url:
        socketio.emit('video_stream_switch', {
            'session_id': session_id,
            'user_id': live_session.host_doctor_id,
            'hls_url': hls_url.decode(),
            'is_broadcaster': True
        }, room=str(session_id), namespace='/live')
        logger.info(f"Utilisateur coupé, retour au flux du diffuseur pour la session {session_id}")
        if request.content_type == "application/json":
            return jsonify({"message": "Utilisateur coupé", "hls_url": hls_url.decode()}), 200
        return redirect(url_for("tnt.live_session_detail", session_id=session_id))
    if request.content_type == "application/json":
        return jsonify({"error": "Aucun flux diffuseur disponible"}), 404
    return render_template("tnt/live_session_detail.html", error="Aucun flux diffuseur disponible", user=user, session=live_session), 404

def update_video_queue_positions(session_id):
    entries = VideoQueue.query.filter_by(session_id=session_id, status='waiting').order_by(VideoQueue.position.asc()).all()
    for index, entry in enumerate(entries, 1):
        entry.position = index
    db.session.commit()


@tnt_bp.route('/live-session/<int:session_id>/quiz/create', methods=['POST'])
@jwt_required()
def create_quiz(session_id):
    try:
        user_id = get_jwt_identity()
        logging.info(f"Tentative de création quiz pour session {session_id} par user_id: {user_id}")
        if not user_id:
            logging.error("Aucune identité utilisateur dans le JWT")
            return jsonify({'error': 'Identité utilisateur invalide'}), 401
        user = User.query.get(user_id)
        if not user:
            logging.error(f"Utilisateur non trouvé pour user_id: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if user.role != 'doctor':
            logging.warning(f"Tentative non autorisée de créer un quiz par {user.email}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        session = LiveSession.query.get(session_id)
        if not session:
            logging.error(f"Session non trouvée: session_id={session_id}")
            return jsonify({'error': 'Session non trouvée'}), 404
        data = request.get_json()
        logging.debug(f"Données reçues: {data}")
        question = data.get('question')
        options = data.get('options')
        correct_option = data.get('correct_option')
        duration = data.get('duration', 30)
        if not question or not options or len(options) != 4 or correct_option not in [0, 1, 2, 3] or duration < 10:
            logging.error(f"Données invalides: {data}")
            return jsonify({'error': 'Données invalides'}), 422
        quiz = LiveQuiz(
            session_id=session_id,
            question=question,
            options=options,
            correct_option=correct_option,
            duration=duration,
            created_at=datetime.utcnow()
        )
        db.session.add(quiz)
        db.session.commit()
        socketio.emit('new_quiz', {
            'quiz_id': quiz.id,
            'session_id': session_id,
            'question': quiz.question
        }, room=str(user_id), namespace='/live')
        logging.info(f"Quiz créé pour la session {session_id} par {user.email}, quiz_id: {quiz.id}")
        return jsonify({'message': 'Quiz créé', 'quiz_id': quiz.id}), 201
    except Exception as e:
        logging.error(f"Erreur dans create_quiz (session_id={session_id}): {str(e)}", exc_info=True)
        return jsonify({'error': 'Erreur serveur interne'}), 500

@tnt_bp.route('/live-session/<int:session_id>/quiz/enable', methods=['POST'])
@jwt_required()
def enable_quiz(session_id):
    try:
        user_id = get_jwt_identity()
        quiz_id = request.args.get('quiz_id', type=int)
        if not quiz_id:
            return jsonify({'error': 'Quiz ID manquant'}), 400
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            return jsonify({'error': 'Accès non autorisé'}), 403
        session = LiveSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session non trouvée'}), 404
        quiz = LiveQuiz.query.get(quiz_id)
        if not quiz or quiz.session_id != session_id:
            return jsonify({'error': 'Quiz non trouvé'}), 404
        expires_at = datetime.utcnow() + timedelta(seconds=quiz.duration)
        quiz.expires_at = expires_at
        db.session.commit()
        quiz_data = {
            'quiz_id': quiz.id,
            'session_id': session_id,
            'question': quiz.question,
            'options': quiz.options,
            'duration': quiz.duration,
            'expires_at': expires_at.isoformat(),
            'correct_option': quiz.correct_option
        }
        logging.info(f'Émission quiz_enabled: {quiz_data}')
        socketio.emit('quiz_enabled', quiz_data, room=str(session_id), namespace='/live')
        return jsonify({'message': 'Quiz activé'}), 200
    except Exception as e:
        logging.error(f'Erreur enable_quiz: {str(e)}', exc_info=True)
        return jsonify({'error': 'Erreur serveur'}), 500


@tnt_bp.route('/live-session/<int:session_id>/quiz/disable', methods=['POST'])
@jwt_required()
def disable_quiz(session_id):
    try:
        user_id = get_jwt_identity()
        logging.debug(f"JWT identity: {user_id}")
        if not user_id:
            logging.error("Aucune identité utilisateur dans le JWT")
            return jsonify({'error': 'Identité utilisateur invalide'}), 401
        user = User.query.get(user_id)
        if not user:
            logging.error(f"Utilisateur non trouvé pour user_id: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if user.role != 'doctor':
            logging.warning(f"Tentative non autorisée de désactiver le quiz par {user.email}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        session = LiveSession.query.get(session_id)
        if not session:
            logging.error(f"Session non trouvée: session_id={session_id}")
            return jsonify({'error': 'Session non trouvée'}), 404
        session.quiz_enabled = False
        db.session.commit()
        socketio.emit('quiz_disabled', {'session_id': session_id}, room=str(session_id), namespace='/live')
        logging.info(f"Quiz désactivé pour la session {session_id} par {user.email}")
        return jsonify({'message': 'Quiz désactivé'}), 200
    except Exception as e:
        logging.error(f"Erreur dans disable_quiz (session_id={session_id}): {str(e)}", exc_info=True)
        return jsonify({'error': 'Erreur serveur interne'}), 500

@tnt_bp.route('/live-session/<int:session_id>/quizzes', methods=['GET'])
def get_quizzes(session_id):
    try:
        user_id = session.get("user_id")
        logging.info(f"Tentative de récupération des quiz pour session {session_id} par user_id: {user_id}")
        if not user_id:
            logging.error("Aucune identité utilisateur dans la session")
            return jsonify({'error': 'Identité utilisateur invalide'}), 401
        user = User.query.get(user_id)
        if not user:
            logging.error(f"Utilisateur non trouvé pour user_id: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if user.role != 'doctor':
            logging.warning(f"Tentative non autorisée de récupérer les quiz par {user.email}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        session = LiveSession.query.get(session_id)
        if not session:
            logging.error(f"Session non trouvée: session_id={session_id}")
            return jsonify({'error': 'Session non trouvée'}), 404
        quizzes = LiveQuiz.query.filter_by(session_id=session_id).order_by(LiveQuiz.created_at.desc()).all()
        quiz_list = [{
            'quiz_id': quiz.id,
            'question': quiz.question,
            'options': quiz.options,
            'duration': quiz.duration,
            'created_at': quiz.created_at.isoformat()
        } for quiz in quizzes]
        logging.info(f"Liste des quiz récupérée pour la session {session_id} par {user.email}: {len(quiz_list)} quiz")
        return jsonify(quiz_list), 200
    except Exception as e:
        logging.error(f"Erreur dans get_quizzes (session_id={session_id}): {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@tnt_bp.route('/live-session/<int:session_id>/quiz/<int:quiz_id>/answer', methods=['POST'])
@jwt_required()
def answer_quiz(session_id, quiz_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        selected_option = data.get('selected_option')
        if selected_option is None or not isinstance(selected_option, int):
            return jsonify({'error': 'Option sélectionnée invalide'}), 400
        session = LiveSession.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session non trouvée'}), 404
        quiz = LiveQuiz.query.get(quiz_id)
        if not quiz or quiz.session_id != session_id:
            return jsonify({'error': 'Quiz non trouvé'}), 404
        if quiz.expires_at < datetime.utcnow():
            return jsonify({'error': 'Quiz expiré'}), 400
        
        answer = QuizAnswer(
            quiz_id=quiz_id,
            user_id=user_id,
            selected_option=selected_option,
            submitted_at=datetime.utcnow()
        )
        db.session.add(answer)
        db.session.commit()
        return jsonify({'message': 'Réponse enregistrée'}), 200
    except Exception as e:
        logging.error(f'Erreur answer_quiz: {str(e)}', exc_info=True)
        return jsonify({'error': 'Erreur serveur'}), 500

@tnt_bp.route('/live-session/<int:session_id>/quiz/delete/<int:quiz_id>', methods=['POST'])
@jwt_required()
def delete_quiz(session_id, quiz_id):
    try:
        user_id = get_jwt_identity()
        logging.info(f"Tentative de suppression du quiz {quiz_id} pour session {session_id} par user_id: {user_id}")
        if not user_id:
            logging.error("Aucune identité utilisateur dans le JWT")
            return jsonify({'error': 'Identité utilisateur invalide'}), 401
        user = User.query.get(user_id)
        if not user:
            logging.error(f"Utilisateur non trouvé pour user_id: {user_id}")
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        if user.role != 'doctor':
            logging.warning(f"Tentative non autorisée de supprimer un quiz par {user.email}")
            return jsonify({'error': 'Accès non autorisé'}), 403
        session = LiveSession.query.get(session_id)
        if not session:
            logging.error(f"Session non trouvée: session_id={session_id}")
            return jsonify({'error': 'Session non trouvée'}), 404
        quiz = LiveQuiz.query.get(quiz_id)
        if not quiz or quiz.session_id != session_id:
            logging.error(f"Quiz non trouvé ou invalide: quiz_id={quiz_id}, session_id={session_id}")
            return jsonify({'error': 'Quiz non trouvé'}), 404
        db.session.delete(quiz)
        db.session.commit()
        socketio.emit('quiz_deleted', {
            'quiz_id': quiz_id,
            'session_id': session_id
        }, room=str(user_id), namespace='/live')
        logging.info(f"Quiz {quiz_id} supprimé pour la session {session_id} par {user.email}")
        return jsonify({'message': 'Quiz supprimé'}), 200
    except Exception as e:
        logging.error(f"Erreur dans delete_quiz (session_id={session_id}, quiz_id={quiz_id}): {str(e)}", exc_info=True)
        return jsonify({'error': 'Erreur serveur interne'}), 500


# WebSocket


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
    comment_id = str(uuid.uuid4())
    logger.info(f"Commentaire dans {session_id} par {user.email}: {comment}")
    emit('new_comment', {
        'id': comment_id,
        'user': user.fullname,
        'comment': comment,
        'timestamp': datetime.utcnow().isoformat()
    }, room=str(session_id))

@socketio.on('start_broadcast', namespace='/live')
def on_start_broadcast(data):
    session_id = data['session_id']
    user_id = data['user_id']
    hls_url = data.get('hls_url')
    logger.info(f"Diffusion démarrée dans {session_id} par {user_id}")
    emit('broadcast_started', {'user_id': user_id, 'hls_url': hls_url}, room=str(session_id))