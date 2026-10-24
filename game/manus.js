// Manuset for Kvitteringsspillet: ti valg gjennom et helt liv, og alt havner på kvitteringen.
// Aksels manus fra kvitteringsspillet/kvitteringsspillet.html, skrevet om 2026-10-22 etter
// brukertesting med barn (maskinmakeren godkjente endringene): kortere og enklere tekster,
// både kroner og venner vises alltid (ingen "visning"-steg), du taper bare ved å gå tom for
// penger eller venner (romaskinen «Nei» gir en dyr redningsskøyte i stedet for døden), og
// begge svar på spørsmål 1 gir familien og barnetrygden; spørsmål 2 er nytt: lommeboka (beholder
// du pengene, forsvinner farmor — den nyeste vennen — fra stabelen). "format" forklarer stegene; reglene
// som utfører dem ligger i kvitteringMotor.js, og klokka (3 minutter = 80 år) i kvittering.js.
export const MANUS = {
  "tittel": "Kvitteringsspillet",
  "mal": "Gjennomføre alle nivåer uten å gå i minus, i venner eller kroner.",
  "avslutning": "Vil du ha kvitteringen på det?",
  "format": {
    "steg": [
      "{ \"no\": \"...\" }                       Tekstsvar på norsk. Skrives ut på kvitteringen.",
      "{ \"kroner\": 400, \"post\": \"Lønn\" }   Legger til (pluss) eller trekker fra (minus) kroner. \"post\" er teksten på kvitteringen.",
      "{ \"venner\": [\"Emma\", \"Noah\"] }       Legger vennene øverst i stabelen. Hvert navn skrives som 1x.",
      "{ \"venner\": 4567, \"navn\": \"Ikke navngitt venn\" }  Legger til mange venner med samme navn. Skrives på én linje.",
      "{ \"venner\": -3 }                        Fjerner de 3 nyeste vennene fra stabelen.",
      "{ \"sum\": \"venner\" }                     Skriver ut totalen, f.eks. \"Total venner: 15\". Kan også være \"kroner\".",
      "{ \"visning\": \"venner\" }                 Kvitteringen viser bare venner fra nå av (eller \"kroner\"). Før dette vises begge.",
      "{ \"slutt\": \"død\" }                    Spilleren dør. Spillet er tapt."
    ],
    "tap": "Saldoen sjekkes etter hvert steg. Kroner under 0, eller flere venner fjernet enn det finnes i stabelen, betyr at spillet er tapt.",
    "rekkefolge": "Stegene utføres og skrives ut i den rekkefølgen de står.",
    "bilder": "\"bilde\" er beskrivelsen (vises som [ beskrivelse ] hvis bildet mangler). \"bildefil\" er bildet i mappa bilder/. lag-html.js legger bildene inn i HTML-fila."
  },
  "sporsmal": [
    {
      "nr": 1,
      "tittel": "Plott",
      "tekst": [
        "Livet er mange valg.",
        "Hva om du fikk hele livet på en kvittering?",
        "Vil du bli født?"
      ],
      "bilde": null,
      "pris": null,
      "svar": {
        "Ja": [
          {
            "venner": [
              "Mamma",
              "Pappa",
              "Farmor"
            ]
          },
          {
            "kroner": 1900,
            "post": "Barnetrygd"
          },
          {
            "no": "Så godt det er å leve! Alt du velger fra nå, havner på kvitteringen."
          }
        ],
        "Nei": [
          {
            "venner": [
              "Mamma",
              "Pappa",
              "Farmor"
            ]
          },
          {
            "kroner": 1900,
            "post": "Barnetrygd"
          },
          {
            "no": "Ingen får velge å bli født – du ble det likevel! Men resten av valgene er dine."
          }
        ]
      }
    },
    {
      "nr": 2,
      "tekst": [
        "Du finner en lommebok på bakken.",
        "Det ligger 2000 kr i den.",
        "Beholder du pengene?"
      ],
      "bilde": null,
      "pris": null,
      "svar": {
        "Ja": [
          {
            "kroner": 2000,
            "post": "Funnet lommebok"
          },
          {
            "no": "Lommeboka var farmors. Hun er veldig skuffet."
          },
          {
            "venner": -1
          }
        ],
        "Nei": [
          {
            "no": "Du leverer den tilbake. Finnerlønnen er en invitasjon i bursdag. Der får du fem nye venner."
          },
          {
            "venner": [
              "Emma",
              "Noah",
              "Sara",
              "Ali",
              "Nora"
            ]
          }
        ]
      }
    },
    {
      "nr": 3,
      "tekst": [
        "Kjøper du den?"
      ],
      "bilde": "Labubu",
      "bildefil": "bilder/03-labubu.jpg",
      "pris": 800,
      "svar": {
        "Ja": [
          {
            "venner": [
              "Leah",
              "Oskar",
              "Aksel",
              "Mia"
            ]
          },
          {
            "kroner": -800,
            "post": "Labubu"
          },
          {
            "no": "Labubuen gjør deg populær! Et år senere selger du den."
          },
          {
            "kroner": 900,
            "post": "Labubu solgt"
          }
        ],
        "Nei": [
          {
            "no": "Labubuen er bare en dyr kosebamse. Du sparer heller pengene, så de kan bli flere. Vennene dine synes du er kjedelig."
          },
          {
            "venner": -4
          }
        ]
      }
    },
    {
      "nr": 4,
      "tekst": [
        "Kjøper du det?"
      ],
      "bilde": "Vaffeljern",
      "bildefil": "bilder/04-vaffeljern.jpg",
      "pris": 700,
      "svar": {
        "Ja": [
          {
            "venner": [
              "Ingeborg",
              "Jonas",
              "Amir",
              "Frida",
              "Henrik"
            ]
          },
          {
            "kroner": -700,
            "post": "Vaffeljern"
          },
          {
            "no": "Vaflene dine er så gode at du begynner å selge dem!"
          },
          {
            "kroner": 2900,
            "post": "Vaffelsalg"
          }
        ],
        "Nei": [
          {
            "no": "Når du vil ha vafler, tar du toget til farmor. Det er langt og dyrt."
          },
          {
            "kroner": -2000,
            "post": "Togbillett"
          },
          {
            "no": "Farmor gir deg penger."
          },
          {
            "kroner": 5000,
            "post": "Farmor"
          }
        ]
      }
    },
    {
      "nr": 5,
      "tekst": [
        "Kjøper du denne?"
      ],
      "bilde": "Binokularlupe med optikk mikroskop",
      "bildefil": "bilder/05-binokularlupe.jpg",
      "pris": 1000,
      "svar": {
        "Ja": [
          {
            "venner": -3
          },
          {
            "kroner": -1000,
            "post": "Mikroskop"
          },
          {
            "no": "Du ser på insekter, og oppdager støvmidd overalt. Du blir allergisk og må kjøpe medisin."
          },
          {
            "kroner": -4000,
            "post": "Allergimedisin"
          }
        ],
        "Nei": [
          {
            "no": "Du jobber så mye at du ikke rekker å treffe vennene dine."
          },
          {
            "venner": -10
          },
          {
            "kroner": 14000,
            "post": "Lønn"
          }
        ]
      }
    },
    {
      "nr": 6,
      "tekst": [
        "Kjøper du den?"
      ],
      "bilde": "Ekstremstol",
      "bildefil": "bilder/06-ekstremstol.jpg",
      "pris": 2000,
      "svar": {
        "Ja": [
          {
            "kroner": -2000,
            "post": "Ekstremstol"
          },
          {
            "no": "Alle vil sitte i den kule stolen din. Så knekker den, og vennen som satt i den, krever penger."
          },
          {
            "venner": -1
          },
          {
            "kroner": -3400,
            "post": "Erstatning"
          }
        ],
        "Nei": [
          {
            "no": "Du lager en modell av stolen med piperensere."
          },
          {
            "kroner": -1100,
            "post": "Piperensere"
          },
          {
            "no": "Naboen Arild vil lage flere sammen med deg. Dere selger dem som julegaver!"
          },
          {
            "venner": [
              "Arild"
            ]
          },
          {
            "kroner": 4000,
            "post": "Stolmodeller"
          }
        ]
      }
    },
    {
      "nr": 7,
      "tekst": [
        "Kjøper du den?"
      ],
      "bilde": "Casall romaskin",
      "bildefil": "bilder/07-romaskin.jpg",
      "pris": 3000,
      "svar": {
        "Ja": [
          {
            "kroner": -3000,
            "post": "Casall romaskin"
          },
          {
            "no": "Du trener masse og blir sterk. Du blir med i en roklubb!"
          },
          {
            "venner": [
              "Vilde",
              "Magnus",
              "Linnea",
              "Tobias",
              "Hedda"
            ]
          }
        ],
        "Nei": [
          {
            "no": "Du vil heller ro en ekte båt over Skagerrak. Halvveis får du vondt i ryggen og må hentes med redningsskøyte."
          },
          {
            "kroner": -25000,
            "post": "Redningsskøyte"
          }
        ]
      }
    },
    {
      "nr": 8,
      "tekst": [
        "Kjøper du den?"
      ],
      "bilde": "Hallberg-Rassy Rasmus 35 fot enmastet – 1974",
      "bildefil": "bilder/08-seilbat.jpg",
      "pris": 19000,
      "svar": {
        "Ja": [
          {
            "kroner": -19000,
            "post": "Seilbåt"
          },
          {
            "no": "Du kjøper en seilbåt og får tre nye venner som vil være med og seile."
          },
          {
            "venner": [
              "Kjetil",
              "Stian",
              "Mons"
            ]
          },
          {
            "no": "Om vinteren vil ingen seile. Vennene forsvinner, og du blir kvitt båten for nesten ingenting."
          },
          {
            "venner": -4
          },
          {
            "kroner": 50,
            "post": "Båten solgt"
          }
        ],
        "Nei": [
          {
            "no": "Du kjøper ikke båten, men havet frister fortsatt. Du blir med tre jenter som seiler over Atlanterhavet. Turen koster deg 10 000 kr."
          },
          {
            "venner": [
              "Ingrid",
              "Sunniva",
              "Maja"
            ]
          },
          {
            "kroner": -10000,
            "post": "Atlanterhavstur"
          }
        ]
      }
    },
    {
      "nr": 9,
      "tekst": [
        "Kjøper du den?"
      ],
      "bilde": "Urne med lokk",
      "bildefil": "bilder/09-urne.jpg",
      "pris": 500,
      "svar": {
        "Ja": [
          {
            "kroner": -500,
            "post": "Urne med lokk"
          },
          {
            "no": "Du kjøper en brukt urne. Vennene dine synes det er litt rart."
          },
          {
            "venner": -2
          },
          {
            "no": "Men i begravelsen din kommer mange flere enn du trodde!"
          },
          {
            "venner": [
              "Tuva",
              "Emil",
              "Selma",
              "Filip",
              "Thea",
              "Sander",
              "Ella",
              "Mathias",
              "Iben",
              "Jakob",
              "Aurora",
              "Even"
            ]
          }
        ],
        "Nei": [
          {
            "no": "Du vil heller at asken din strøs over havet. Noen venner synes det er rart."
          },
          {
            "venner": -5
          },
          {
            "no": "Det havner i avisen, og hele Norge vil minnes deg!"
          },
          {
            "venner": 4567,
            "navn": "Ikke navngitt venn"
          }
        ]
      }
    },
    {
      "nr": 10,
      "tittel": "Epilog",
      "merknad": "Valget er å kjøpe selve maskinen spillet ble spilt på. Kommer etter livet er over.",
      "tekst": [
        "Kjøper du denne?"
      ],
      "bilde": "Kvitteringsspillet",
      "bildefil": "bilder/10-kvitteringsspillet.jpg",
      "pris": 10000,
      "svar": {
        "Ja": [
          {
            "no": "Gratulerer! Du har kjøpt maskinen."
          },
          {
            "no": "Livsforsikringen din betaler for den."
          },
          {
            "kroner": 10000,
            "post": "Livsforsikring"
          },
          {
            "kroner": -10000,
            "post": "Kvitteringsspillet"
          },
          {
            "sum": "venner"
          },
          {
            "sum": "kroner"
          }
        ],
        "Nei": [
          {
            "no": "Vil du ha kvitteringen?"
          }
        ]
      }
    }
  ]
};
