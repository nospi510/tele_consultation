from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from app import db
from app.models.consultation import Consultation

class ActionSaveSymptoms(Action):
    def name(self) -> Text:
        return "action_save_symptoms"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        symptoms = tracker.latest_message.get('text')
        user_id = tracker.sender_id  # ID de l'utilisateur (peut être adapté)

        # Sauvegarde des symptômes dans la base de données
        consultation = Consultation(user_id=user_id, symptoms=symptoms, is_ai_diagnosis=True)
        db.session.add(consultation)
        db.session.commit()

        dispatcher.utter_message(text="Vos symptômes ont été enregistrés. Un médecin ou notre IA va vous répondre bientôt.")
        return []