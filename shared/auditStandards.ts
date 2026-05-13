/**
 * Specialty-keyed audit standard presets.
 * Each preset provides a standard reference, a measurable criteria statement,
 * a recommended target compliance percentage, and a common exception note.
 * Sources: NICE guidelines, RCSENG ENT guidance, BAO-HNS standards, BACO guidance.
 */

export interface StandardPreset {
  standard: string;
  criteria: string;
  compliance: string;
  exceptions: string;
}

export const SPECIALTY_STANDARD_PRESETS: Record<string, StandardPreset[]> = {
  "Head and Neck": [
    {
      standard: "NICE NG36",
      criteria: "Patients with suspected head and neck cancer should be referred via 2-week wait pathway",
      compliance: "100%",
      exceptions: "Patient declines referral (documented)",
    },
    {
      standard: "RCSENG Head & Neck Standards 2023",
      criteria: "Multidisciplinary team (MDT) discussion documented for all new head and neck cancer diagnoses",
      compliance: "100%",
      exceptions: "Emergency presentations prior to MDT availability",
    },
    {
      standard: "NICE NG36 §1.3",
      criteria: "Patients with confirmed head and neck cancer should receive a treatment plan within 31 days of diagnosis",
      compliance: "95%",
      exceptions: "Patient-initiated delays; complex staging requiring additional imaging",
    },
    {
      standard: "BAO-HNS Thyroid Guidelines",
      criteria: "Fine needle aspiration cytology (FNAC) performed for thyroid nodules ≥1 cm with suspicious ultrasound features",
      compliance: "95%",
      exceptions: "Purely cystic nodules; patient anticoagulation requiring bridging",
    },
    {
      standard: "NICE NG36 §1.6",
      criteria: "All patients with head and neck cancer should have a clinical nurse specialist (CNS) allocated",
      compliance: "100%",
      exceptions: "None",
    },
    {
      standard: "NICE QS175",
      criteria: "Patients with head and neck cancer should have a documented nutritional assessment at diagnosis",
      compliance: "95%",
      exceptions: "Patients admitted as emergency bypassing outpatient pathway",
    },
    {
      standard: "RCSENG Salivary Gland Standards",
      criteria: "Ultrasound performed as first-line imaging for salivary gland masses",
      compliance: "95%",
      exceptions: "Deep lobe parotid tumours where MRI is indicated as first-line",
    },
  ],

  "Otology": [
    {
      standard: "NICE NG98",
      criteria: "Adults with sudden sensorineural hearing loss should be referred urgently (within 24 hours) to ENT",
      compliance: "100%",
      exceptions: "Patients presenting outside working hours where on-call pathway is used",
    },
    {
      standard: "NICE NG98 §1.2",
      criteria: "Oral corticosteroids offered to adults with sudden sensorineural hearing loss within 24 hours of presentation",
      compliance: "95%",
      exceptions: "Contraindications to steroids (uncontrolled diabetes, active peptic ulcer, immunosuppression)",
    },
    {
      standard: "BAO-HNS Otology Standards 2022",
      criteria: "Pure tone audiogram (PTA) performed at first outpatient appointment for patients with hearing loss",
      compliance: "95%",
      exceptions: "Acute otitis externa preventing accurate testing; patient unable to comply",
    },
    {
      standard: "NICE NG98 §1.5",
      criteria: "MRI internal auditory meati (IAM) offered to patients with unilateral or asymmetric sensorineural hearing loss",
      compliance: "90%",
      exceptions: "Patient declines; MRI contraindicated (pacemaker, severe claustrophobia)",
    },
    {
      standard: "RCSENG Cochlear Implant Guidelines",
      criteria: "Cochlear implant candidacy assessment completed within 6 months of referral",
      compliance: "90%",
      exceptions: "Patient not fit for surgery; patient-initiated delays",
    },
    {
      standard: "NICE NG98 §1.9",
      criteria: "Patients with chronic suppurative otitis media (CSOM) should have documented trial of topical antibiotic therapy before surgical referral",
      compliance: "95%",
      exceptions: "Cholesteatoma identified; allergy to topical antibiotics",
    },
    {
      standard: "BAO-HNS Tinnitus Standards",
      criteria: "Patients with tinnitus should receive a validated tinnitus questionnaire (THI or TQ) at first appointment",
      compliance: "90%",
      exceptions: "Patients with significant cognitive impairment",
    },
  ],

  "Rhinology": [
    {
      standard: "NICE NG206",
      criteria: "Patients with chronic rhinosinusitis (CRS) should receive a minimum 12-week trial of intranasal corticosteroids before surgical referral",
      compliance: "95%",
      exceptions: "Nasal polyps causing significant obstruction; suspected malignancy",
    },
    {
      standard: "RCSENG Rhinology Standards 2023",
      criteria: "Nasal endoscopy performed at first outpatient assessment for patients with CRS",
      compliance: "95%",
      exceptions: "Patient declines; severe septal deviation preventing scope passage",
    },
    {
      standard: "NICE NG206 §1.4",
      criteria: "CT sinuses performed before functional endoscopic sinus surgery (FESS)",
      compliance: "100%",
      exceptions: "None — mandatory pre-operative requirement",
    },
    {
      standard: "BSACI Rhinitis Guidelines",
      criteria: "Patients with allergic rhinitis should have skin prick testing or specific IgE testing offered",
      compliance: "90%",
      exceptions: "Patients on antihistamines; severe eczema preventing skin testing",
    },
    {
      standard: "RCSENG Epistaxis Standards",
      criteria: "Patients admitted with epistaxis should have documented blood pressure measurement",
      compliance: "100%",
      exceptions: "None",
    },
    {
      standard: "NICE NG206 §1.7",
      criteria: "Post-operative follow-up appointment arranged within 6 weeks of FESS",
      compliance: "95%",
      exceptions: "Patient-initiated cancellations",
    },
    {
      standard: "RCSENG Septal Standards",
      criteria: "Septoplasty patients should have documented pre-operative nasal obstruction score (NOSE score)",
      compliance: "90%",
      exceptions: "Emergency cases; patients with cognitive impairment",
    },
  ],

  "Paediatric": [
    {
      standard: "NICE NG60",
      criteria: "Children with obstructive sleep apnoea (OSA) should have adenotonsillectomy offered as first-line treatment",
      compliance: "95%",
      exceptions: "Significant co-morbidities increasing anaesthetic risk; parental refusal",
    },
    {
      standard: "NICE NG60 §1.3",
      criteria: "Polysomnography or overnight oximetry performed before adenotonsillectomy for OSA in children with complex needs",
      compliance: "95%",
      exceptions: "Straightforward cases without co-morbidity where clinical diagnosis is clear",
    },
    {
      standard: "NICE NG91",
      criteria: "Children with persistent bilateral glue ear and hearing loss should be offered grommets after 3 months of watchful waiting",
      compliance: "90%",
      exceptions: "Parental preference for continued watchful waiting; seasonal variation in fluid",
    },
    {
      standard: "RCSENG Paediatric ENT Standards 2022",
      criteria: "Children undergoing tonsillectomy should have documented Grading of Tonsil Size (Brodsky scale) in notes",
      compliance: "95%",
      exceptions: "None",
    },
    {
      standard: "NICE NG91 §1.5",
      criteria: "Audiological assessment performed within 4 weeks of referral for children with suspected hearing loss",
      compliance: "90%",
      exceptions: "Capacity constraints; child not cooperative at first attempt",
    },
    {
      standard: "RCSENG Paediatric Airway Standards",
      criteria: "Children with suspected subglottic stenosis should have rigid bronchoscopy under general anaesthetic for diagnosis",
      compliance: "100%",
      exceptions: "None — diagnostic gold standard",
    },
    {
      standard: "NICE NG60 §1.8",
      criteria: "Post-operative telephone follow-up at 48 hours after paediatric tonsillectomy",
      compliance: "90%",
      exceptions: "Patient/parent not contactable; patient still inpatient",
    },
  ],

  "General ENT": [
    {
      standard: "NICE NG84",
      criteria: "Adults with dysphagia should be referred for urgent investigation within 2 weeks if malignancy is suspected",
      compliance: "100%",
      exceptions: "Patient declines referral (documented)",
    },
    {
      standard: "RCSENG ENT Standards",
      criteria: "Patients seen in outpatient clinic should receive a clinic letter within 7 working days",
      compliance: "95%",
      exceptions: "Complex cases requiring MDT input before letter completion",
    },
    {
      standard: "NICE NG84 §1.2",
      criteria: "Flexible nasendoscopy (FNE) performed for patients with persistent hoarseness >3 weeks",
      compliance: "95%",
      exceptions: "Patient declines; severe gag reflex preventing procedure",
    },
  ],
};

/** Returns presets for a given specialty, falling back to General ENT if not found. */
export function getStandardPresets(specialty: string): StandardPreset[] {
  // Try direct match first
  if (SPECIALTY_STANDARD_PRESETS[specialty]) {
    return SPECIALTY_STANDARD_PRESETS[specialty];
  }
  // Try partial match (e.g. "Paediatric and Laryngology" → "Paediatric")
  for (const key of Object.keys(SPECIALTY_STANDARD_PRESETS)) {
    if (specialty.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(specialty.toLowerCase())) {
      return SPECIALTY_STANDARD_PRESETS[key];
    }
  }
  return SPECIALTY_STANDARD_PRESETS["General ENT"];
}

export const ALL_STANDARD_PRESETS: StandardPreset[] = Object.values(SPECIALTY_STANDARD_PRESETS).flat();
