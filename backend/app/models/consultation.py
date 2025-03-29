from app import db
from datetime import datetime

class Consultation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symptoms = db.Column(db.Text, nullable=False)
    diagnosis = db.Column(db.Text)
    doctor_id = db.Column(db.Integer, nullable=True)
    is_ai_diagnosis = db.Column(db.Boolean, default=False) 
    status = db.Column(db.String(50), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    conversation_history = db.Column(db.Text, default="")
     #  champs pour la notation
    rating = db.Column(db.Integer, nullable=True) 
    comment = db.Column(db.String(500), nullable=True) 

      # Champs pour le rappel de médicaments
    medication_name = db.Column(db.String(100), nullable=True)
    medication_dosage = db.Column(db.String(100), nullable=True)
    medication_reminder_time = db.Column(db.String(5), nullable=True)  
    medication_reminder_sent = db.Column(db.Boolean, default=False)  # Indiquer si le rappel a été envoyé


    user = db.relationship('User', backref=db.backref('consultations', lazy=True))

    def __repr__(self):
        return f"<Consultation {self.id} - User {self.user_id}>"

class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    appointment_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(50), default="scheduled")  # Statut du rendez-vous (planifié, annulé, etc.)
    
    patient = db.relationship('User', foreign_keys=[patient_id], backref=db.backref('appointments_as_patient', lazy=True))
    doctor = db.relationship('User', foreign_keys=[doctor_id], backref=db.backref('appointments_as_doctor', lazy=True))

    def __repr__(self):
        return f"<Appointment {self.id} - Patient {self.patient_id} - Doctor {self.doctor_id}>"