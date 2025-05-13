from datetime import timedelta
from flask import Flask,jsonify
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
import os
from flask_socketio import SocketIO
import redis



db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*")  

# Création du client Redis
redis_client = redis.StrictRedis(host='192.168.1.42', port=6379, db=0)

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)  # Token valable 24h



    # Configuration des sessions avec Redis
    
    app.config['SESSION_TYPE'] = 'redis'
    app.config['SESSION_REDIS'] = redis_client
    app.config['SESSION_PERMANENT'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

    Session(app)  # ⚠️ Initialiser la gestion de session


    db.init_app(app)
    Migrate(app, db)
    jwt.init_app(app)
    CORS(app, origins="*")  # Autorise toutes les origines 

    # Configuration Swagger pour la sécurité Bearer
    app.config['SWAGGER'] = {
        'securityDefinitions': {
            'BearerAuth': {
                'type': 'apiKey',
                'name': 'Authorization',
                'in': 'header',
                'description': 'JWT Bearer token, must be prefixed with `Bearer` (e.g., "Bearer <token>")'
            }
        },
        'security': [{'BearerAuth': []}],
    }

    # Initialisation de Swagger
    Swagger(app)

    # Initialisation de SocketIO
    socketio.init_app(app, cors_allowed_origins="*") 
    

    # Importation des Blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.consultation_routes import consultation_bp
    from app.routes.twilio_routes import twilio_bp
    from app.routes.chatbot_routes import chatbot_bp
    from app.routes.user_routes import user_bp
    from app.routes.tnt_routes import tnt_bp

    # Enregistrement des Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(consultation_bp, url_prefix="/api/consultation")
    app.register_blueprint(twilio_bp, url_prefix="/api/twilio")
    app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(tnt_bp, url_prefix="/api/tnt")

        # Gestion des erreurs globales
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Ressource non trouvée"}), 404

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({"error": "Erreur interne du serveur"}), 500

    return app, socketio  # Retourne app et socketio

