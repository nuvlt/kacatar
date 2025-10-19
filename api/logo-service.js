{
  "name": "kacatar-api",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "firebase-admin": "^11.11.1"
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Manuel logo URL'leri (PNG versiyonları)
const MANUAL_LOGO_URLS = {
  // Büyük kulüpler
  "psg": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "paris saint-germain": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "paris saint germain": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "atleti": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/100px-Atletico_Madrid_2017_logo.svg.png",
  "atletico madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/100px-Atletico_Madrid_2017_logo.svg.png",
  "barça": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/100px-FC_Barcelona_%28crest%29.svg.png",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/100px-FC_Barcelona_%28crest%29.svg.png",
  "inter": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/100px-FC_Internazionale_Milano_2021.svg.png",
  "augsburg": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/FC_Augsburg_logo.svg/100px-FC_Augsburg_logo.svg.png",
  "leverkusen": "https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Bayer_04_Leverkusen_logo.svg/100px-Bayer_04_Leverkusen_logo.svg.png",
  "marseille": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Olympique_Marseille_logo.svg/100px-Olympique_Marseille_logo.svg.png",
  "nice": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a5/OGC_Nice_logo.svg/100px-OGC_Nice_logo.svg.png",
  "tottenham": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/100px-Tottenham_Hotspur.svg.png",
  "west ham": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/West_Ham_United_FC_logo.svg/100px-West_Ham_United_FC_logo.svg.png",
  "espanyol": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/RCD_Espanyol_logo.svg/100px-RCD_Espanyol_logo.svg.png",
  "rayo vallecano": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Rayo_Vallecano_logo.svg/100px-Rayo_Vallecano_logo.svg.png",
  "real betis": "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_Betis_logo_2019.svg/100px-Real_Betis_logo_2019.svg.png",
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/RCD_Mallorca_logo.svg/100px-RCD_Mallorca_logo.svg.png",
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d0/Club_Atletico_Osasuna_logo.svg/100px-Club_Atletico_Osasuna_logo.svg.png",
  "celta": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/100px-RC_Celta_de_Vigo_logo.svg.png",
  "alavés": "https://upload.wikimedia.org/wikipedia/en/thumb/7/70/Deportivo_Alaves_logo.svg/100px-Deportivo_Alaves_logo.svg.png",
  "verona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Hellas_Verona_FC_logo.svg/100px-Hellas_Verona_FC_logo.svg.png",
  "ac pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
  "pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
  
  // Fransız takımlar
  "auxerre": "https://upload.wikimedia.org/wikipedia/en/thumb/2/22/AJ_Auxerre_Logo.svg/100px-AJ_Auxerre_Logo.svg.png",
  "aj auxerre": "https://upload.wikimedia.org/wikipedia/en/thumb/2/22/AJ_Auxerre_Logo.svg/100px-AJ_Auxerre_Logo.svg.png",
  "le havre": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Le_Havre_AC_logo_%282024%29.svg/100px-Le_Havre_AC_logo_%282024%29.svg.png",
  "le havre ac": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Le_Havre_AC_logo_%282024%29.svg/100px-Le_Havre_AC_logo_%282024%29.svg.png",
  "lorient": "https://upload.wikimedia.org/wikipedia/fr/thumb/d/db/FC_Lorient_2010_logo.svg/100px-FC_Lorient_2010_logo.svg.png",
  "fc lorient": "https://upload.wikimedia.org/wikipedia/fr/thumb/d/db/FC_Lorient_2010_logo.svg/100px-FC_Lorient_2010_logo.svg.png",
  "angers": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Logo_Angers_SCO_2020.svg/100px-Logo_Angers_SCO_2020.svg.png",
  "angers sco": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Logo_Angers_SCO_2020.svg/100px-Logo_Angers_SCO_2020.svg.png",
  "toulouse": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Toulouse_FC_2018_logo.svg/100px-Toulouse_FC_2018_logo.svg.png",
  "toulouse fc": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Toulouse_FC_2018_logo.svg/100px-Toulouse_FC_2018_logo.svg.png",
  "brest": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Stade_Brestois_29_logo.svg/100px-Stade_Brestois_29_logo.svg.png",
  "stade brestois": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Stade_Brestois_29_logo.svg/100px-Stade_Brestois_29_logo.svg.png",
  "rc lens": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/RC_Lens_logo.svg/100px-RC_Lens_logo.svg.png",
  "lens": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/RC_Lens_logo.svg/100px-RC_Lens_logo.svg.png",
  "nantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/FC_Nantes_logo.svg/100px-FC_Nantes_logo.svg.png",
  "fc nantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/FC_Nantes_logo.svg/100px-FC_Nantes_logo.svg.png",
  "stade rennais": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Stade_Rennais_F.C._logo.svg/100px-Stade_Rennais_F.C._logo.svg.png",
  "rennes": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Stade_Rennais_F.C._logo.svg/100px-Stade_Rennais_F.C._logo.svg.png",
  "strasbourg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg/100px-Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg.png",
  "rc strasbourg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg/100px-Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg.png",
  "paris fc": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/Paris_FC_logo.svg/100px-Paris_FC_logo.svg.png",
  "lille": "https://upload.wikimedia.org/wikipedia/en/thumb/6/68/Lille_OSC_%282018%29_logo.svg/100px-Lille_OSC_%282018%29_logo.svg.png",
  "lille osc": "https://upload.wikimedia.org/wikipedia/en/thumb/6/68/Lille_OSC_%282018%29_logo.svg/100px-Lille_OSC_%282018%29_logo.svg.png",
  "lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Olympique_Lyonnais_logo.svg/100px-Olympique_Lyonnais_logo.svg.png",
  "olympique lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Olympique_Lyonnais_logo.svg/100px-Olympique_Lyonnais_logo.svg.png",
  "monaco": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Logo_AS_Monaco_FC_%282013%29.svg/100px-Logo_AS_Monaco_FC_%282013%29.svg.png",
  "as monaco": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Logo_AS_Monaco_FC_%282013%29.svg/100px-Logo_AS_Monaco_FC_%282013%29.svg.png",
  
  // Alman takımlar
  "bremen": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/100px-SV-Werder-Bremen-Logo.svg.png",
  "werder bremen": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/100px-SV-Werder-Bremen-Logo.svg.png",
  "frankfurt": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Eintracht_Frankfurt_Logo.svg/100px-Eintracht_Frankfurt_Logo.svg.png",
  "eintracht frankfurt": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Eintracht_Frankfurt_Logo.svg/100px-Eintracht_Frankfurt_Logo.svg.png",
  "hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/100px-Logo_TSG_Hoffenheim.svg.png",
  "tsg hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/100px-Logo_TSG_Hoffenheim.svg.png",
  "stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/100px-VfB_Stuttgart_1893_Logo.svg.png",
  "vfb stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/100px-VfB_Stuttgart_1893_Logo.svg.png",
  "union berlin": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_Union_Berlin_logo.svg/100px-FC_Union_Berlin_logo.svg.png",
  "fc union berlin": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_Union_Berlin_logo.svg/100px-FC_Union_Berlin_logo.svg.png",
  "wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo-VfL-Wolfsburg.svg/100px-Logo-VfL-Wolfsburg.svg.png",
  "vfl wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo-VfL-Wolfsburg.svg/100px-Logo-VfL-Wolfsburg.svg.png",
  "m'gladbach": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/100px-Borussia_M%C3%B6nchengladbach_logo.svg.png",
  "borussia monchengladbach": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/100px-Borussia_M%C3%B6nchengladbach_logo.svg.png",
  "heidenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/1._FC_Heidenheim_1846_logo.svg/100px-1._FC_Heidenheim_1846_logo.svg.png",
  "fc heidenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/1._FC_Heidenheim_1846_logo.svg/100px-1._FC_Heidenheim_1846_logo.svg.png",
  "hsv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/HSV-Logo.svg/100px-HSV-Logo.svg.png",
  "hamburger sv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/HSV-Logo.svg/100px-HSV-Logo.svg.png",
  "st. pauli": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_St._Pauli_logo.svg/100px-FC_St._Pauli_logo.svg.png",
  "fc st pauli": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_St._Pauli_logo.svg/100px-FC_St._Pauli_logo.svg.png",
  "1. fc köln": "https://upload.wikimedia.org/wikipedia/en/thumb/1/19/1_FC_Koln_logo.svg/100px-1_FC_Koln_logo.svg.png",
  "fc koln": "https://upload.wikimedia.org/wikipedia/en/thumb/1/19/1_FC_Koln_logo.svg/100px-1_FC_Koln_logo.svg.png",
  
  // İngiliz takımlar
  "brighton": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/100px-Brighton_%26_Hove_Albion_logo.svg.png",
  "brighton hove": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/100px-Brighton_%26_Hove_Albion_logo.svg.png",
  "man united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
  "manchester united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
  "wolverhampton": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Wolverhampton_Wanderers.svg/100px-Wolverhampton_Wanderers.svg.png",
  "wolves": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Wolverhampton_Wanderers.svg/100px-Wolverhampton_Wanderers.svg.png",
  "arsenal": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/100px-Arsenal_FC.svg.png",
  "aston villa": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Aston_Villa_logo.svg/100px-Aston_Villa_logo.svg.png",
  "bournemouth": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/AFC_Bournemouth_%282013%29.svg/100px-AFC_Bournemouth_%282013%29.svg.png",
  "brentford": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Brentford_FC_crest.svg/100px-Brentford_FC_crest.svg.png",
  "burnley": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/Burnley_FC_Logo.svg/100px-Burnley_FC_Logo.svg.png",
  "chelsea": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/100px-Chelsea_FC.svg.png",
  "crystal palace": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Crystal_Palace_FC_logo_%282022%29.svg/100px-Crystal_Palace_FC_logo_%282022%29.svg.png",
  "everton": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Everton_FC_logo.svg/100px-Everton_FC_logo.svg.png",
  "fulham": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Fulham_FC_%28shield%29.svg/100px-Fulham_FC_%28shield%29.svg.png",
  "leeds united": "https://upload.wikimedia.org/wikipedia/en/thumb/5/54/Leeds_United_F.C._logo.svg/100px-Leeds_United_F.C._logo.svg.png",
  "liverpool": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/100px-Liverpool_FC.svg.png",
  "man city": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/100px-Manchester_City_FC_badge.svg.png",
  "manchester city": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/100px-Manchester_City_FC_badge.svg.png",
  "newcastle": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Newcastle_United_Logo.svg/100px-Newcastle_United_Logo.svg.png",
  "nottingham": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Nottingham_Forest_F.C._logo.svg/100px-Nottingham_Forest_F.C._logo.svg.png",
  "nottingham forest": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Nottingham_Forest_F.C._logo.svg/100px-Nottingham_Forest_F.C._logo.svg.png",
  "sunderland": "https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Logo_Sunderland.svg/100px-Logo_Sunderland.svg.png",
  
  // İspanyol takımlar
  "athletic": "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/100px-Club_Athletic_Bilbao_logo.svg.png",
  "athletic bilbao": "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/100px-Club_Athletic_Bilbao_logo.svg.png",
  "elche": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1e/Elche_CF_logo.svg/100px-Elche_CF_logo.svg.png",
  "getafe": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Getafe_logo.svg/100px-Getafe_logo.svg.png",
  "girona": "https://upload.wikimedia.org/wikipedia/en/thumb/7/79/Girona_FC_logo.svg/100px-Girona_FC_logo.svg.png",
  "levante": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg/100px-Levante_Uni%C3%B3n_Deportiva%2C_S.A.D._logo.svg.png",
  "real madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/100px-Real_Madrid_CF.svg.png",
  "real oviedo": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Real_Oviedo_logo.svg/100px-Real_Oviedo_logo.svg.png",
  "real sociedad": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/100px-Real_Sociedad_logo.svg.png",
  "sevilla": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/100px-Sevilla_FC_logo.svg.png",
  "sevilla fc": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/100px-Sevilla_FC_logo.svg.png",
  "valencia": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/100px-Valenciacf.svg.png",
  "villarreal": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/100px-Villarreal_CF_logo-en.svg.png",
  
  // İtalyan takımlar
  "atalanta": "https://upload.wikimedia.org/wikipedia/en/thumb/6/66/Atalanta_BC_logo.svg/100px-Atalanta_BC_logo.svg.png",
  "bologna": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Bologna_FC_1909_logo.svg/100px-Bologna_FC_1909_logo.svg.png",
  "cagliari": "https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Cagliari_Calcio_1920_logo.svg/100px-Cagliari_Calcio_1920_logo.svg.png",
  "como 1907": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Como_1907_logo.svg/100px-Como_1907_logo.svg.png",
  "como": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Como_1907_logo.svg/100px-Como_1907_logo.svg.png",
  "cremonese": "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/US_Cremonese_logo.svg/100px-US_Cremonese_logo.svg.png",
  "fiorentina": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/ACF_Fiorentina.svg/100px-ACF_Fiorentina.svg.png",
  "genoa": "https://upload.wikimedia.org/wikipedia/en/thumb/6/62/Genoa_CFC_logo.svg/100px-Genoa_CFC_logo.svg.png",
  "juventus": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Juventus_FC_-_pictogram_black_%28Italy%2C_2017%29.svg/100px-Juventus_FC_-_pictogram_black_%28Italy%2C_2017%29.svg.png",
  "lazio": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/S.S._Lazio_badge.svg/100px-S.S._Lazio_badge.svg.png",
  "lecce": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/US_Lecce.svg/100px-US_Lecce.svg.png",
  "milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/100px-Logo_of_AC_Milan.svg.png",
  "ac milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/100px-Logo_of_AC_Milan.svg.png",
  "napoli": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/SSC_Neapel.svg/100px-SSC_Neapel.svg.png",
  "parma": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1e/Parma_Calcio_1913_logo.svg/100px-Parma_Calcio_1913_logo.svg.png",
  "roma": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/AS_Roma_logo_%282017%29.svg/100px-AS_Roma_logo_%282017%29.svg.png",
  "sassuolo": "https://upload.wikimedia.org/wikipedia/en/thumb/1/18/US_Sassuolo_Calcio_logo.svg/100px-US_Sassuolo_Calcio_logo.svg.png",
  "torino": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Torino_FC_Logo.svg/100px-Torino_FC_Logo.svg.png",
  "udinese": "https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Udinese_Calcio_logo.svg/100px-Udinese_Calcio_logo.svg.png",
  
  // Alman takımlar - ekstra
  "bayern": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/100px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
  "bayern munich": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/100px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
  "dortmund": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/100px-Borussia_Dortmund_logo.svg.png",
  "borussia dortmund": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/100px-Borussia_Dortmund_logo.svg.png",
  "freiburg": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/SC_Freiburg_logo.svg/100px-SC_Freiburg_logo.svg.png",
  "sc freiburg": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/SC_Freiburg_logo.svg/100px-SC_Freiburg_logo.svg.png",
  "mainz": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Logo_Mainz_05.svg/100px-Logo_Mainz_05.svg.png",
  "mainz 05": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Logo_Mainz_05.svg/100px-Logo_Mainz_05.svg.png",
  "rb leipzig": "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/RB_Leipzig_2014_logo.svg/100px-RB_Leipzig_2014_logo.svg.png",
  "leipzig": "https://upload.wikimedia.org/wikipedia/en/thumb/0/04/RB_Leipzig_2014_logo.svg/100px-RB_Leipzig_2014_logo.svg.png",
  
  // Fransız takımlar - ekstra
  "fc metz": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/FC_Metz_logo_%282022%29.svg/100px-FC_Metz_logo_%282022%29.svg.png",
  "metz": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/FC_Metz_logo_%282022%29.svg/100px-FC_Metz_logo_%282022%29.svg.png",
};

// Takım adını temizle
function cleanTeamName(name) {
  if (!name) return "";
  
  return String(name)
    .replace(/\s+FC$|\s+CF$|\s+AC$|\s+SC$|\s+UD$|\s+ACF$|\s+SSC$/i, "")
    .replace(/[^\w\s\-\&\.çğıöşüÇĞİÖŞÜ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// TheSportsDB API - TEK kaynak
async function tryTheSportsDB(teamName, apiKey) {
  if (!apiKey) return null;
  
  try {
    await delay(300);
    
    const cleanName = cleanTeamName(teamName);
    const namesToTry = [
      cleanName,
      cleanName.replace(/-/g, " "),
      cleanName.replace(/ /g, "-"),
    ];
    
    for (const searchName of namesToTry) {
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(searchName)}`;
      
      console.log(`🔍 TheSportsDB: ${teamName} → ${searchName}`);
      const response = await fetch(url, { timeout: 8000 });
      
      const text = await response.text();
      
      // HTML döndüysa skip
      if (text.startsWith("<") || text.startsWith("<!")) {
        console.warn(`⚠️ TheSportsDB HTML döndü: ${teamName}`);
        continue;
      }
      
      const data = JSON.parse(text);
      
      if (data?.teams?.[0]) {
        const logo = data.teams[0].strTeamBadge || data.teams[0].strTeamLogo || data.teams[0].strBadge;
        if (logo) {
          console.log(`✅ TheSportsDB buldu: ${teamName}`);
          return logo;
        }
      }
      
      await delay(200);
    }
    
  } catch (error) {
    console.warn(`❌ TheSportsDB error: ${teamName}`, error.message);
  }
  
  return null;
}

// Ana logo bulma fonksiyonu
async function findTeamLogo(teamName, apiKeys) {
  const { thesportsdb } = apiKeys;
  
  console.log(`\n🎯 Logo aranıyor: ${teamName}`);
  
  // 1. Manuel URL'lere bak
  const lowerName = teamName.toLowerCase().trim();
  const cleanedLower = cleanTeamName(teamName).toLowerCase();
  
  if (MANUAL_LOGO_URLS[lowerName]) {
    console.log(`✅ Manuel URL bulundu: ${teamName}`);
    return MANUAL_LOGO_URLS[lowerName];
  }
  
  if (MANUAL_LOGO_URLS[cleanedLower]) {
    console.log(`✅ Manuel URL bulundu (cleaned): ${teamName}`);
    return MANUAL_LOGO_URLS[cleanedLower];
  }
  
  // 2. TheSportsDB
  const logo = await tryTheSportsDB(teamName, thesportsdb);
  if (logo) return logo;
  
  console.log(`❌ Logo bulunamadı: ${teamName}`);
  return null;
}

module.exports = {
  findTeamLogo,
  cleanTeamName,
};
