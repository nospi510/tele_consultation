from app import db
from datetime import datetime

# Table associative pour les diffuseurs 
session_broadcasters = db.Table(
    'session_broadcasters',
    db.Column('session_id', db.Integer, db.ForeignKey('live_session.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

# Table associative pour les participants 
session_participants = db.Table(
    'session_participants',
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
    quiz_enabled = db.Column(db.Boolean, default=False)

    # Relations
    host = db.relationship('User', foreign_keys=[host_doctor_id])
    broadcasters = db.relationship('User', secondary=session_broadcasters, lazy='subquery')
    participants = db.relationship('User', secondary=session_participants, lazy='subquery')

    def __repr__(self):
        return f'<LiveSession {self.title}>'

class LiveQuestion(db.Model):
    __tablename__ = 'live_question'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('live_session.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    answer_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    answered_at = db.Column(db.DateTime, nullable=True)

    # Relations
    session = db.relationship('LiveSession', backref=db.backref('questions', lazy=True))
    user = db.relationship('User', backref=db.backref('live_questions', lazy=True))

    def __repr__(self):
        return f'<LiveQuestion {self.id} - Session {self.session_id}>'

class LiveQuiz(db.Model):
    __tablename__ = 'live_quiz'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('live_session.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=False)
    correct_option = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)

    # Relations
    session = db.relationship('LiveSession', backref=db.backref('quizzes', lazy=True))

    def __repr__(self):
        return f'<LiveQuiz {self.id} - Session {self.session_id}>'

class QuizAnswer(db.Model):
    __tablename__ = 'quiz_answer'

    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('live_quiz.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    selected_option = db.Column(db.Integer, nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relations
    quiz = db.relationship('LiveQuiz', backref=db.backref('answers', lazy=True))
    user = db.relationship('User', backref=db.backref('quiz_answers', lazy=True))

    def __repr__(self):
        return f'<QuizAnswer {self.id} - Quiz {self.quiz_id} - User {self.user_id}>'

class VideoQueue(db.Model):
    __tablename__ = 'video_queue'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('live_session.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='waiting')  # waiting, active, ended
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relations
    session = db.relationship('LiveSession', backref=db.backref('video_queue', lazy=True))
    user = db.relationship('User', backref=db.backref('video_queue_entries', lazy=True))

    def __repr__(self):
        return f'<VideoQueue {self.id} - User {self.user_id} - Session {self.session_id}>'