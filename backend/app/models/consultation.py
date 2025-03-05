from app import db
from datetime import datetime

class Consultation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symptoms = db.Column(db.Text, nullable=False)
    diagnosis = db.Column(db.Text)
    doctor_id = db.Column(db.Integer, nullable=True)
    is_ai_diagnosis = db.Column(db.Boolean, default=False)  # Nouveau champ
    status = db.Column(db.String(50), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversation_history = db.Column(db.Text, default="")

    user = db.relationship('User', backref=db.backref('consultations', lazy=True))

    def __repr__(self):
        return f"<Consultation {self.id} - User {self.user_id}>"