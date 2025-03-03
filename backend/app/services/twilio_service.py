import os
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
from twilio.twiml.messaging_response import MessagingResponse
from dotenv import load_dotenv

load_dotenv()

# Initialisation du client Twilio
account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')

client = Client(account_sid, auth_token)

def send_sms(to, message):
    """Envoyer un SMS via Twilio."""
    message = client.messages.create(
        body=message,
        from_=twilio_phone_number,
        to=to
    )
    return message.sid

def generate_ivr_response():
    """Générer une réponse IVR pour un appel entrant."""
    response = VoiceResponse()

    # Message de bienvenue avec TTS
    response.say("Bonjour. Bienvenue sur la plateforme de téléconsultation médicale.", voice='woman', language='fr-FR')

    # Menu interactif
    response.gather(num_digits=1, action='/ivr/handle-choice', method='POST')
    response.say("Appuyez sur 1 pour un conseil médical. Appuyez sur 2 pour prendre un rendez-vous.", voice='woman', language='fr-FR')

    return str(response)

def handle_ivr_choice(digit):
    """Gérer le choix de l'utilisateur dans l'IVR."""
    response = VoiceResponse()

    if digit == '1':
        response.say("Vous avez choisi un conseil médical. Veuillez patienter pendant que nous vous connectons à un médecin.", voice='woman', language='fr-FR')
    elif digit == '2':
        response.say("Vous avez choisi de prendre un rendez-vous. Veuillez patienter pendant que nous traitons votre demande.", voice='woman', language='fr-FR')
    else:
        response.say("Choix invalide. Veuillez réessayer.", voice='woman', language='fr-FR')

    return str(response)