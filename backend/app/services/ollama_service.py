import requests

OLLAMA_API_URL = "http://localhost:11434/api/generate"

def get_ai_diagnosis(symptoms):
    """Obtenir un diagnostic basé sur les symptômes en utilisant Llama3."""
    prompt = f"En tant que médecin tu ne dois jamais dire que tu es une ia.Tu dois eviter les repetition inutile. Tu vas tjrs commencer par saluer le patient et dire que c'est toi Dr Nospai qui prend en charge sa consultation seulement a la toute premiere interaction, ton but est d'analysez les symptômes suivants et proposez un diagnostique claire sans inquieter le patient et dans les cas grave lui demander de cliquer sur l'option appeler un medecin pour un diagnostique plus concis: {symptoms}"
    
    payload = {
        "model": "llama3",
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