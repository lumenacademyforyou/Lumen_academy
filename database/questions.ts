import { Question } from "../types";

export const BIOLOGY_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Which of the following codons is a universal start codon and also codes for Methionine?",
    textTa: "பின்வரும் கோடான்களில் எது உலகளாவிய தொடக்க கோடான் மற்றும் மெத்தியோனினையும் குறிக்கிறது?",
    options: ["UAA", "AUG", "UGA", "UAG"],
    optionsTa: ["UAA", "AUG", "UGA", "UAG"],
    correctAnswerIndex: 1,
    subject: "Botany",
    unit: "Molecular Basis of Inheritance",
    ncertReference: "NCERT Class 12 Biology, Chapter 6 (Molecular Basis of Inheritance), Page 112, Paragraph 6.6",
    explanation: "AUG is the universal start codon in genetic translation and specifically codes for Methionine in eukaryotes."
  },
  {
    id: 2,
    text: "During DNA replication, the leading strand is synthesized in which of the following directions?",
    textTa: "டிஎன்ஏ நகலெடுக்கும் போது, முன்னணி இழையானது பின்வரும் எந்த திசைகளில் தொகுக்கப்படுகிறது?",
    options: [
      "Continuously in the 5' → 3' direction",
      "Discontinuously in the 5' → 3' direction",
      "Continuously in the 3' → 5' direction",
      "Discontinuously in the 3' → 5' direction"
    ],
    optionsTa: [
      "5' → 3' திசையில் தொடர்ச்சியாக",
      "5' → 3' திசையில் தொடர்ச்சியற்று",
      "3' → 5' திசையில் தொடர்ச்சியாக",
      "3' → 5' திசையில் தொடர்ச்சியற்று"
    ],
    correctAnswerIndex: 0,
    subject: "Botany",
    unit: "Molecular Basis of Inheritance",
    ncertReference: "NCERT Class 12 Biology, Chapter 6, Page 107, Figure 6.8 (Replication Fork)",
    explanation: "DNA polymerase synthesizes DNA only in the 5' → 3' direction. Thus, the leading strand is synthesized continuously in the 5' → 3' direction."
  },
  {
    id: 3,
    text: "According to Mendel's experiments, what is the phenotypic ratio of the F2 generation in a dihybrid cross?",
    textTa: "மெண்டலின் சோதனைகளின்படி, இருபண்பு கலப்பில் F2 தலைமுறையின் புறத்தோற்ற விகிதம் என்ன?",
    options: ["3:1", "9:3:3:1", "1:2:1", "9:3:4"],
    optionsTa: ["3:1", "9:3:3:1", "1:2:1", "9:3:4"],
    correctAnswerIndex: 1,
    subject: "Botany",
    unit: "Genetics & Evolution",
    ncertReference: "NCERT Class 12 Biology, Chapter 5 (Principles of Inheritance), Page 83",
    explanation: "A Mendel dihybrid cross yields a phenotypic ratio of 9:3:3:1 in the F2 generation, representing combinations of dominant and recessive traits."
  },
  {
    id: 4,
    text: "Which type of natural selection favors extreme phenotypes over intermediate phenotypes, potentially splitting a population into two distinct groups?",
    textTa: "எந்த வகையான இயற்கைத் தேர்வு இடைநிலை புறத்தோற்றங்களை விட தீவிர புறத்தோற்றங்களுக்கு சாதகமாக உள்ளது, இதனால் ஒரு உயிரினத்தொகையை இரண்டு தனித்துவமான குழுக்களாகப் பிரிக்கலாம்?",
    options: ["Stabilizing Selection", "Directional Selection", "Disruptive Selection", "Artificial Selection"],
    optionsTa: ["நிலைப்படுத்தும் தேர்வு", "திசை தேர்வு", "சிதைக்கும் தேர்வு", "செயற்கை தேர்வு"],
    correctAnswerIndex: 2,
    subject: "Botany",
    unit: "Genetics & Evolution",
    ncertReference: "NCERT Class 12 Biology, Chapter 7 (Evolution), Page 137, Figure 7.8",
    explanation: "Disruptive selection selects against average individuals, favoring both extremes and leading to speciation or divergence."
  },
  {
    id: 5,
    text: "Which ecological pyramid is always upright and can never be inverted in any ecosystem?",
    textTa: "எந்த சூழலியல் பிரமிடு எப்போதும் நேராக இருக்கும் மற்றும் எந்த சுற்றுச்சூழல் அமைப்பிலும் ஒருபோதும் தலைகீழாக இருக்க முடியாது?",
    options: ["Pyramid of Biomass", "Pyramid of Energy", "Pyramid of Numbers", "All pyramids can be inverted"],
    optionsTa: ["உயிரித்திரள் பிரமிடு", "ஆற்றல் பிரமிடு", "எண்ணிக்கை பிரமிடு", "அனைத்து பிரமிடுகளும் தலைகீழாக இருக்கலாம்"],
    correctAnswerIndex: 1,
    subject: "Botany",
    unit: "Ecology & Environment",
    ncertReference: "NCERT Class 12 Biology, Chapter 14 (Ecosystem), Page 248, Section 14.5",
    explanation: "The pyramid of energy is always upright because energy is lost as heat at each trophic level according to Lindeman's 10% law."
  },
  {
    id: 6,
    text: "The first clinical gene therapy was given in 1990 to a four-year-old girl with which of the following genetic deficiencies?",
    textTa: "1990 ஆம் ஆண்டில் எந்த மரபணு குறைபாடுள்ள நான்கு வயது சிறுமிக்கு முதல் மருத்துவ மரபணு சிகிச்சை அளிக்கப்பட்டது?",
    options: [
      "Adenosine deaminase (ADA) deficiency",
      "Cystic fibrosis",
      "Phenylketonuria",
      "Emphysema"
    ],
    optionsTa: [
      "அடினோசின் டீமினேஸ் (ADA) குறைபாடு",
      "சிஸ்டிக் ஃபைப்ரோஸிஸ்",
      "பினைல்கீட்டோனூரியா",
      "எம்பிஸிமா"
    ],
    correctAnswerIndex: 0,
    subject: "Zoology",
    unit: "Biotechnology & Applications",
    ncertReference: "NCERT Class 12 Biology, Chapter 12 (Biotechnology Applications), Page 211",
    explanation: "Adenosine Deaminase (ADA) deficiency was the first disease treated with clinical gene therapy, where functional ADA cDNA was introduced into Lymphocytes."
  },
  {
    id: 7,
    text: "An association between sea anemone and hermit crab, where both organisms benefit from each other, is classified as which interaction?",
    textTa: "கடல் சாமந்தி மற்றும் துறவி நண்டு ஆகியவற்றுக்கு இடையேயான தொடர்பு, இரு உயிரினங்களும் ஒன்றையொன்று பயனடையும் வகையில் எந்த தொடர்பாடலாக வகைப்படுத்தப்படுகிறது?",
    options: ["Commensalism", "Amensalism", "Mutualism", "Parasitism"],
    optionsTa: ["உடனுறைவு", "அமென்சாலிசம்", "ஒட்டுறவு (Mutualism)", "ஒட்டுண்ணி நிலை"],
    correctAnswerIndex: 2,
    subject: "Zoology",
    unit: "Ecology & Environment",
    ncertReference: "NCERT Class 12 Biology, Chapter 13 (Organisms & Populations), Page 237",
    explanation: "Mutualism is an obligate or facultative interaction where both species benefit from each other."
  },
  {
    id: 8,
    text: "Which of the following represents a primary consumer in a terrestrial ecosystem grazing food chain?",
    textTa: "ஒரு நிலப்பரப்பு சுற்றுச்சூழல் மேய்ச்சல் உணவுச் சங்கிலியில் பின்வருவனவற்றில் எது முதன்மை நுகர்வோரைக் குறிக்கிறது?",
    options: ["Green plant", "Grasshopper", "Frog", "Eagle"],
    optionsTa: ["பச்சை தாவரம்", "வெட்டுக்கிளி", "தவளை", "கழுகு"],
    correctAnswerIndex: 1,
    subject: "Zoology",
    unit: "Ecology & Environment",
    ncertReference: "NCERT Class 12 Biology, Chapter 14, Page 245",
    explanation: "Primary consumers are herbivores that feed directly on producers (green plants). A grasshopper is a classic primary consumer."
  },
  {
    id: 9,
    text: "According to the Hardy-Weinberg principle, if 'p' represents the frequency of dominant allele and 'q' represents recessive allele, what does '2pq' represent?",
    textTa: "ஹார்டி-வெயின்பெர்க் கொள்கையின்படி, 'p' என்பது ஓங்கு அல்லீலின் நிகழ்வெண்ணையும், 'q' என்பது ஒடுங்கு அல்லீலையும் குறித்தால், '2pq' எதைக் குறிக்கிறது?",
    options: [
      "Frequency of homozygous dominant individuals",
      "Frequency of homozygous recessive individuals",
      "Frequency of heterozygous individuals",
      "Total genetic variance"
    ],
    optionsTa: [
      "ஹோமோசைகஸ் ஓங்கு தனிநபர்களின் நிகழ்வெண்",
      "ஹோமோசைகஸ் ஒடுங்கு தனிநபர்களின் நிகழ்வெண்",
      "ஹெட்டிரோசைகஸ் தனிநபர்களின் நிகழ்வெண்",
      "மொத்த மரபணு மாறுபாடு"
    ],
    correctAnswerIndex: 2,
    subject: "Zoology",
    unit: "Genetics & Evolution",
    ncertReference: "NCERT Class 12 Biology, Chapter 7 (Evolution), Page 136, Equation 7.1",
    explanation: "In Hardy-Weinberg equilibrium (p² + 2pq + q² = 1), 2pq represents the frequency of heterozygous individuals."
  },
  {
    id: 10,
    text: "Who proposed the 'Semi-conservative' scheme of DNA replication prior to its experimental proof by Meselson and Stahl?",
    textTa: "மெசெல்சன் மற்றும் ஸ்டாலால் சோதனை மூலம் நிரூபிக்கப்படுவதற்கு முன்பு, டிஎன்ஏ நகலெடுப்பதன் 'அரை-பழமைப் பேணும்' (Semi-conservative) திட்டத்தை முன்மொழிந்தவர் யார்?",
    options: ["Watson and Crick", "Hershey and Chase", "Alfred Wallace", "Hugo de Vries"],
    optionsTa: ["வாட்சன் மற்றும் கிரிக்", "ஹெர்ஷே மற்றும் சேஸ்", "ஆல்ஃபிரட் வாலஸ்", "ஹ்யூகோ டி விரிஸ்"],
    correctAnswerIndex: 0,
    subject: "Zoology",
    unit: "Molecular Basis of Inheritance",
    ncertReference: "NCERT Class 12 Biology, Chapter 6, Page 104, Paragraph 6.4",
    explanation: "Watson and Crick originally postulated the semi-conservative replication model alongside their double-helix model in 1953."
  }
];

export const CHEMISTRY_QUESTIONS: Question[] = [
  {
    id: 11,
    text: "Which of the following elements has the highest negative electron gain enthalpy in the p-block?",
    textTa: "பி-தொகுதியிலுள்ள பின்வரும் தனிமங்களில் அதிகபட்ச எதிர்மறை எலக்ட்ரான் நாட்டம் கொண்டது எது?",
    options: ["Fluorine", "Chlorine", "Bromine", "Oxygen"],
    optionsTa: ["புளோரின்", "குளோரின்", "புரோமின்", "ஆக்சிஜன்"],
    correctAnswerIndex: 1,
    subject: "Chemistry",
    unit: "p-Block & Periodic Trends",
    ncertReference: "NCERT Class 11 Chemistry Vol 1, Chapter 3, Page 88, Table 3.7",
    explanation: "Chlorine has the highest negative electron gain enthalpy. Although Fluorine is more electronegative, its small size causes strong inter-electronic repulsions, making addition of an electron less exothermic than in Chlorine."
  },
  {
    id: 12,
    text: "What is the hybridization of Xenon in Xenon tetrafluoride (XeF4)?",
    textTa: "செனான் டெட்ராபுளோரைடில் (XeF4) உள்ள செனானின் இனக்கலப்பு என்ன?",
    options: ["sp3", "sp3d", "sp3d2", "sp3d3"],
    optionsTa: ["sp3", "sp3d", "sp3d2", "sp3d3"],
    correctAnswerIndex: 2,
    subject: "Chemistry",
    unit: "p-Block & Inorganic Chemistry",
    ncertReference: "NCERT Class 12 Chemistry Vol 1, Chapter 7 (p-Block Elements), Page 207",
    explanation: "XeF4 has 4 bond pairs and 2 lone pairs on Xenon. The steric number is 6, which corresponds to sp3d2 hybridization with a square planar geometry."
  },
  {
    id: 13,
    text: "Which of the following solutions will have the highest boiling point elevation at the same concentration?",
    textTa: "ஒரே செறிவில் பின்வரும் எந்தக் கரைசல் அதிகபட்ச கொதிநிலை ஏற்றத்தைக் கொண்டிருக்கும்?",
    options: ["Glucose", "Sodium Chloride (NaCl)", "Barium Chloride (BaCl2)", "Urea"],
    optionsTa: ["குளுக்கோஸ்", "சோடியம் குளோரைடு (NaCl)", "பேரியம் குளோரைடு (BaCl2)", "யூரியா"],
    correctAnswerIndex: 2,
    subject: "Chemistry",
    unit: "Solutions & Physical Chemistry",
    ncertReference: "NCERT Class 12 Chemistry Vol 1, Chapter 2 (Solutions), Page 54, Section 2.6.4",
    explanation: "Barium Chloride dissociates into 3 ions (Ba2+ and 2 Cl-), so its van 't Hoff factor (i) is 3. Since elevation in boiling point is a colligative property proportional to 'i', BaCl2 gives the highest elevation."
  },
  {
    id: 14,
    text: "Which of the following forms the basis of the coordination compounds theory proposed by Alfred Werner?",
    textTa: "ஆல்ஃபிரட் வெர்னரால் முன்மொழியப்பட்ட அணைவுச் சேர்மங்கள் கோட்பாட்டின் அடிப்படை பின்வருவனவற்றில் எது?",
    options: ["Primary and Secondary valencies", "Crystal Field Theory", "Ligand Field Theory", "Molecular Orbital Theory"],
    optionsTa: ["முதன்மை மற்றும் இரண்டாம் நிலை இணைதிறன்கள்", "படிகப்புலக் கொள்கை", "ஈனி புலக் கொள்கை", "மூலக்கூறு ஆர்பிட்டால் கொள்கை"],
    correctAnswerIndex: 0,
    subject: "Chemistry",
    unit: "Coordination Compounds",
    ncertReference: "NCERT Class 12 Chemistry Vol 1, Chapter 9 (Coordination Compounds), Page 244",
    explanation: "Werner's coordination theory postulates that metals exhibit two types of valency: Primary (ionizable, satisfying oxidation state) and Secondary (non-ionizable, satisfying coordination number)."
  },
  {
    id: 15,
    text: "In the reaction of alkyl halides with sodium in dry ether (Wurtz Reaction), what is the key intermediate formed?",
    textTa: "உலர் ஈதரில் சோடியத்துடன் ஆல்கைல் ஹாலைடுகள் வினைபுரியும் போது (வுர்ட்ஸ் வினை), உருவாகும் முக்கிய இடைநிலை என்ன?",
    options: ["Carbocation", "Carbanion", "Free Radical", "Carbene"],
    optionsTa: ["கார்பன் நேரயனி", "கார்பன் எதிரயனி", "தனி உறுப்பு (Free Radical)", "கார்பீன்"],
    correctAnswerIndex: 2,
    subject: "Chemistry",
    unit: "Organic Chemistry - Reactions",
    ncertReference: "NCERT Class 12 Chemistry Vol 2, Chapter 10 (Haloalkanes & Haloarenes), Page 311",
    explanation: "The Wurtz Reaction typically proceeds via a free-radical mechanism where sodium transfers an electron to the alkyl halide, generating alkyl free radicals."
  }
];

export const PHYSICS_QUESTIONS: Question[] = [
  {
    id: 16,
    text: "A solid sphere and a hollow sphere of same mass and outer radius are released from the top of an inclined plane. Which one reaches the bottom first?",
    textTa: "ஒரே நிறை மற்றும் வெளிப்புற ஆரம் கொண்ட ஒரு திண்மக் கோளம் மற்றும் ஒரு உள்ளீடற்ற கோளம் ஆகியவை சாய்வான தளத்தின் மேலிருந்து விடுவிக்கப்படுகின்றன. எது முதலில் கீழே வரும்?",
    options: ["Hollow sphere", "Solid sphere", "Both reach at the same time", "Depends on the angle of inclination"],
    optionsTa: ["உள்ளீடற்ற கோளம்", "திண்மக் கோளம்", "இரண்டும் ஒரே நேரத்தில் வரும்", "சாய்வு கோணத்தைப் பொறுத்தது"],
    correctAnswerIndex: 1,
    subject: "Physics",
    unit: "Rotational Dynamics & Mechanics",
    ncertReference: "NCERT Class 11 Physics Part 1, Chapter 7 (System of Particles & Rotational Motion), Page 178",
    explanation: "A solid sphere has a lower moment of inertia (2/5 MR2) than a hollow sphere (2/3 MR2), resulting in higher linear acceleration down the incline. Thus, the solid sphere rolls down faster."
  },
  {
    id: 17,
    text: "If the distance between the plates of a parallel plate capacitor is halved and a dielectric of constant K = 4 is inserted, how does the capacitance change?",
    textTa: "இணைத்தட்டு மின்தேக்கியின் தட்டுகளுக்கு இடையிலான தூரம் பாதியாகக் குறைக்கப்பட்டு, K = 4 என்ற மின்காப்புப் பொருள் செருகப்பட்டால், மின்தேக்குத்திறன் எவ்வாறு மாறும்?",
    options: ["Increases by 2 times", "Increases by 4 times", "Increases by 8 times", "Decreases by half"],
    optionsTa: ["2 மடங்கு அதிகரிக்கிறது", "4 மடங்கு அதிகரிக்கிறது", "8 மடங்கு அதிகரிக்கிறது", "பாதியாக குறைகிறது"],
    correctAnswerIndex: 2,
    subject: "Physics",
    unit: "Electrostatics & Capacitance",
    ncertReference: "NCERT Class 12 Physics Part 1, Chapter 2 (Electrostatic Potential & Capacitance), Page 77",
    explanation: "Capacitance C = K * ε0 * A / d. If d is halved (1/2) and K = 4, then the new capacitance C' = 4 * C / (1/2) = 8 C. It increases by 8 times."
  },
  {
    id: 18,
    text: "According to Einstein's photoelectric equation, the graph of maximum kinetic energy of photoelectrons versus frequency of incident radiation is a straight line whose slope is:",
    textTa: "ஐன்ஸ்டீனின் ஒளிமின் சமன்பாட்டின் படி, ஒளி எலக்ட்ரான்களின் அதிகபட்ச இயக்க ஆற்றலுக்கும் படுகதிரின் அதிர்வெண்ணுக்கும் இடையிலான வரைபடம் ஒரு நேர்கோடு ஆகும். அதன் சாய்வு:",
    options: ["Work function", "Planck's constant (h)", "Charge of electron (e)", "Threshold frequency"],
    optionsTa: ["வெளியேற்று ஆற்றல்", "பிளாங்க் மாறிலி (h)", "எலக்ட்ரானின் மின்னூட்டம் (e)", "பயன்தொடக்க அதிர்வெண்"],
    correctAnswerIndex: 1,
    subject: "Physics",
    unit: "Modern Physics & Dual Nature",
    ncertReference: "NCERT Class 12 Physics Part 2, Chapter 11 (Dual Nature of Radiation & Matter), Page 394",
    explanation: "KE_max = hν - Φ. This is of the form y = mx + c, where y is KE_max and x is frequency (ν). The slope m is equal to Planck's constant (h)."
  },
  {
    id: 19,
    text: "What is the de Broglie wavelength of an electron accelerated through a potential difference of 100 Volts?",
    textTa: "100 வோல்ட் மின்னழுத்த வேறுபாட்டால் முடுக்கப்பட்ட எலக்ட்ரானின் டி பிராக்லி அலைநீளம் என்ன?",
    options: ["1.227 Å", "12.27 Å", "0.1227 Å", "122.7 Å"],
    optionsTa: ["1.227 Å", "12.27 Å", "0.1227 Å", "122.7 Å"],
    correctAnswerIndex: 0,
    subject: "Physics",
    unit: "Modern Physics & Dual Nature",
    ncertReference: "NCERT Class 12 Physics Part 2, Chapter 11, Page 398, Equation 11.11",
    explanation: "The de Broglie wavelength of an accelerated electron is given by λ = 12.27 / √V Å. For V = 100, λ = 12.27 / 10 = 1.227 Å."
  },
  {
    id: 20,
    text: "A particle is performing simple harmonic motion (SHM). At what position is its potential energy equal to half of its total energy?",
    textTa: "ஒரு துகள் தனிச்சீரிசை இயக்கத்தை (SHM) மேற்கொள்கிறது. எந்த நிலையில் அதன் நிலை ஆற்றல் அதன் மொத்த ஆற்றலின் பாதிக்கு சமமாக இருக்கும்?",
    options: ["x = A/2", "x = A / √2", "x = A / 2√2", "x = A"],
    optionsTa: ["x = A/2", "x = A / √2", "x = A / 2√2", "x = A"],
    correctAnswerIndex: 1,
    subject: "Physics",
    unit: "Oscillations & SHM",
    ncertReference: "NCERT Class 11 Physics Part 2, Chapter 14 (Oscillations), Page 352",
    explanation: "Total Energy E = 1/2 k A2. Potential Energy U = 1/2 k x2. If U = E/2, then 1/2 k x2 = 1/4 k A2, which yields x2 = A2 / 2, so x = A / √2."
  }
];

export const ALL_QUESTIONS: Question[] = [
  ...BIOLOGY_QUESTIONS,
  ...CHEMISTRY_QUESTIONS,
  ...PHYSICS_QUESTIONS
];
