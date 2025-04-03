from app import db
from datetime import datetime

# Table associative pour les diffuseurs (broadcasters)
session_broadcasters = db.Table('session_broadcasters',
    db.Column('session_id', db.Integer, db.ForeignKey('live_session.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

# Table associative pour les participants (déjà existante ou à ajouter)
session_participants = db.Table('session_participants',
    db.Column('session_id', db.Integer, db.ForeignKey('live_session.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

class LiveSession(db.Model):
    __tablename__ = 'live_session'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    host_doctor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relations
    host = db.relationship('User', foreign_keys=[host_doctor_id])
    broadcasters = db.relationship('User', secondary=session_broadcasters, lazy='subquery')
    participants = db.relationship('User', secondary=session_participants, lazy='subquery')

    def __repr__(self):
        return f'<LiveSession {self.title}>'