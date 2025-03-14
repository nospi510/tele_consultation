from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flasgger import Swagger
import os

db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    db.init_app(app)
    Migrate(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

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
        'security': [{'BearerAuth': []}],  # Applique ce schéma de sécurité à toutes les routes
    }
    
    # Initialisation de Swagger
    Swagger(app)

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

    return app
