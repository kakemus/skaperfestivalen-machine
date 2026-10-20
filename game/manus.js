// Aksels manus for Kvitteringsspillet: ti valg gjennom et helt liv, og alt havner på kvitteringen.
// Hentet uendret fra kvitteringsspillet/kvitteringsspillet.html. "format" forklarer stegene;
// reglene som utfører dem ligger i kvitteringMotor.js.
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
            "no": "Så godt det er å leve! Hvem du er, og hva du velger, setter spor i verden, og du har gleden av å oppleve konsekvensene!"
          }
        ],
        "Nei": [
          {
            "no": "Vi velger ikke å bli født. Kjenn godt etter. Du fortsetter å leve, uansett om dagen er god eller dårlig. Livet er alle de andre valgene, de du faktisk har."
          }
        ]
      }
    },
    {
      "nr": 2,
      "tekst": [
        "Hva vil du spare på?",
        "Venner eller penger?"
      ],
      "bilde": null,
      "pris": null,
      "svar": {
        "Venner": [
          {
            "visning": "venner"
          },
          {
            "venner": [
              "Emma",
              "Noah",
              "Sara",
              "Ali",
              "Nora"
            ]
          },
          {
            "no": "Venner gir deg valgmuligheter. De inviterer deg med, gir deg gratis kaffe hvis de jobber på kafé, og kanskje kjenner de noen som kan gi deg jobb."
          }
        ],
        "Penger": [
          {
            "visning": "kroner"
          },
          {
            "kroner": 1000,
            "post": "Sparing"
          },
          {
            "no": "Penger gir deg valgmuligheter. Du kan betale for å få ting gjort, for å dra dit du vil, og for å få det du vil ha."
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
            "no": "Labubuen er et statussymbol, som gjør deg populær. Du selger den 1 år senere."
          },
          {
            "kroner": 900,
            "post": "Labubu solgt"
          }
        ],
        "Nei": [
          {
            "no": "Labubuen er en meningsløs og dyr kosebamse. Du vil heller investere pengene lurt. Du tenker på ROI."
          },
          {
            "no": "Vennene dine synes du er kjedelig."
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
            "no": "Du har skjønt at vaffelhjerter er veien inn i venners hjerter. Vennene dine sier vaflene er så gode at du kan selge dem. Du selger vafler."
          },
          {
            "kroner": 2900,
            "post": "Vaffelsalg"
          }
        ],
        "Nei": [
          {
            "no": "Vaffeljernet er dyrt. Når du vil ha vafler, drar du heller til farmor. Hun bor langt unna."
          },
          {
            "kroner": -2000,
            "post": "Togbillett"
          },
          {
            "no": "Hun gir deg penger."
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
            "post": "Binokularlupe"
          },
          {
            "no": "Du kjøper mikroskopet for å se på insekter. Snart oppdager du en hel verden av interessante ting du tidligere ikke kunne se. For eksempel støvmidd. Et helt år går. Du får ekstrem støvallergi, og må kjøpe allergimedisin."
          },
          {
            "kroner": -4000,
            "post": "Allergimedisin"
          }
        ],
        "Nei": [
          {
            "no": "Du vil heller forholde deg til verden på din størrelse, som for eksempel venner og jobb."
          },
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
            "no": "Ekstremstolen din er kul, og alle vil sitte i den. Når den siste av vennene dine slenger seg ned i den, knekker stolen. De krever erstatning."
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
            "no": "Du lager en modell av Ekstremstolen med piperensere, og setter den i vinduet."
          },
          {
            "kroner": -1100,
            "post": "Piperensere"
          },
          {
            "no": "En dag stopper naboen deg for å fortelle at han kjente Terje Ekstrøms kone."
          },
          {
            "venner": [
              "Arild"
            ]
          },
          {
            "no": "Dere blir enige om å lage modeller av Ekstremstolen sammen, for å selge dem for 250 kroner stykket. Det er den perfekte julegaven."
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
            "no": "Du har sett Terje Vigen på teatret. Inspirert av roingen hans kjøper du deg en romaskin. Du trener lite, men leser masse om Napoleonskrigene, og blir populær på fest."
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
            "no": "Du kjøper ikke romaskinen. Det bryter ut krig i Europa, og England innfører handelsblokade i Nordsjøen. Du bestemmer deg for å ro til Danmark for å skaffe korn. Halvveis over Skagerrak får du prolaps."
          },
          {
            "no": "Du dør."
          },
          {
            "slutt": "død"
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
            "post": "Hallberg-Rassy Rasmus 35"
          },
          {
            "no": "Å seile med vinden, og leve i takt med bølgene frister. Du kjøper en seilbåt og får plutselig tre nye venner som sier de «vil lære å seile»."
          },
          {
            "venner": [
              "Kjetil",
              "Stian",
              "Mons"
            ]
          },
          {
            "no": "Du skjønner at vinteropplag vil koste 7680 kroner, og vil selge båten. Ingen vil kjøpe den, så du panter den hos Kambo marina."
          },
          {
            "venner": -4
          },
          {
            "kroner": 9500,
            "post": "Kambo marina (pant)"
          }
        ],
        "Nei": [
          {
            "no": "Livet på havet fortsetter å friste, og du blir med tre jenter som skal krysse Atlanterhavet. Opplevelsen er skjellsettende, og du kan endelig gi slipp på samfunnets krav og leve livet ditt."
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
            "no": "Du finner en «pent brukt» urne på Finn. Vennene dine skjønner at noe er galt. Du mister noen, mens andre kommer nærmere."
          },
          {
            "venner": -2
          },
          {
            "no": "I begravelsen din kommer det mange flere enn du trodde, til og med klassekamerater fra barneskolen."
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
            "no": "Du trenger ingen urne, og vil bli strødd for vinden over Skagerrak, der Terje Vigen rodde. Flere venner syns det er rart."
          },
          {
            "venner": -5
          },
          {
            "no": "Seremonien blir plukket opp av Hvaler Budstikke og blir en nasjonal sensasjon. Kirkene åpner for at publikum kan komme og minnes livet ditt i hele Norge."
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
            "no": "Gratulerer! Du har kjøpt maskinen. Vi vil straks betjene kjøpet ditt!"
          },
          {
            "no": "Livsforsikringen din betaler ut."
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
            "no": "Beregner summer ...."
          },
          {
            "sum": "venner"
          },
          {
            "sum": "kroner"
          }
        ],
        "Nei": []
      }
    }
  ]
};
