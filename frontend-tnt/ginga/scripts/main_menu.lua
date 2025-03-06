-- Importation des modules nécessaires
local http = require("socket.http")
local json = require("dkjson")

-- Fonction pour récupérer les conseils médicaux
function getAdvice(symptom)
  local url = "http://localhost:5001/api/tnt/advice?symptom=" .. symptom
  local response, status = http.request(url)

  if status == 200 then
    local data = json.decode(response)
    alert("Conseil médical : " .. data.advice)
  else
    alert("Erreur lors de la récupération des conseils.")
  end
end

-- Menu interactif
function main_menu()
  local options = {
    "Fièvre et toux",
    "Maux de tête",
    "Douleurs abdominales"
  }

  for i, option in ipairs(options) do
    print(i .. ". " .. option)
  end

  local choice = tonumber(io.read())

  if choice and choice >= 1 and choice <= #options then
    getAdvice(options[choice])
  else
    alert("Choix invalide.")
  end
end

-- Lancement du menu
main_menu()