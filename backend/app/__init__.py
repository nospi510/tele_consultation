from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
import os
from flasgger import Swagger


db = SQLAlchemy()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    db.init_app(app)
    Migrate(app, db)
    jwt.init_app(app)
    CORS(app)

    # Initialisation de Swagger
    Swagger(app)
    
    from app.routes.auth import auth_bp
    from app.routes.consultation import consultation_bp
    from app.routes.twilio_routes import twilio_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(consultation_bp, url_prefix="/api/consultation")
    app.register_blueprint(twilio_bp, url_prefix="/twilio")

    return app

