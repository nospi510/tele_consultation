import requests
import random

OLLAMA_API_URL = "http://localhost:11434/api/generate"

def get_ai_diagnosis(symptoms):
    """Obtenir un diagnostic basé sur les symptômes en utilisant Gemma."""
    prompt = f"En tant que médecin tu ne dois jamais dire que tu es une IA. Tu dois éviter les répétitions inutiles. Tu vas toujours commencer par saluer le patient et dire que c'est toi Dr Nospai qui prend en charge sa consultation et ce seulement à la toute première interaction, ton but est d'analyser les symptômes suivants et proposer un diagnostic clair sans inquiéter le patient et dans les cas graves lui demander de cliquer sur l'option appeler un médecin pour un diagnostic plus concis : {symptoms}"
    
    payload = {
        "model": "gemma:2b", 
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_API_URL, json=payload)
        response.raise_for_status()
        diagnosis = response.json().get("response", "Désolé, je n'ai pas pu générer de diagnostic.")
        return diagnosis
    except Exception as e:
        print(f"Erreur lors de la génération du diagnostic : {e}")
        return "Désolé, une erreur s'est produite lors de la génération du diagnostic."

def get_ai_health_tips():
    """Générer des conseils de santé généraux variés avec Gemma."""
    # Liste de thèmes pour varier les conseils
    themes = [
        "conseils pour rester hydraté et en bonne santé",
        "habitudes pour renforcer votre système immunitaire",
        "astuces pour améliorer votre sommeil",
        "conseils pour une alimentation équilibrée",
        "recommandations pour réduire le stress quotidien",
        "exercices simples pour rester actif"
    ]
    
    # Choisir un thème aléatoire pour éviter la répétition
    selected_theme = random.choice(themes)
    
    prompt = f"En tant que médecin, je suis Dr Nospai. Fournis-moi des conseils de santé clairs et pratiques sur ce thème : {selected_theme}. Ne dis pas que tu es une IA, sois direct et évite les répétitions inutiles."

    payload = {
        "model": "gemma:2b",
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_API_URL, json=payload)
        response.raise_for_status()
        tips = response.json().get("response", "Restez hydraté et mangez équilibré !")
        return tips
    except Exception as e:
        print(f"Erreur lors de la génération des conseils : {e}")
        return "Restez hydraté et prenez soin de vous !"