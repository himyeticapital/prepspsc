"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Map,
  FileText,
  ListChecks,
  HelpCircle,
  BarChart3,
  Loader2,
  CheckCircle2,
  Brain,
  Youtube,
  ExternalLink,
  PenLine,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  Upload,
  Image as ImageIcon,
  Link,
  Trash2,
  Eye,
  Clock,
  Camera,
  Keyboard,
  Crown,
  GraduationCap,
  BookOpen,
  Presentation,
  BookMarked,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PaperBlurtUpload } from "@/components/study-ai/revision/paper-blurt-upload";
import { UpgradeModal } from "@/components/tests/upgrade-modal";
import { GuidedLearningChat } from "@/components/study-ai/guided-learning";
import { NotebookTab } from "@/components/study-ai/notebook/notebook-tab";
import { VoiceInput } from "@/components/ui/voice-input";
import { createClient } from "@/lib/supabase/client";


interface TopicStudyPanelProps {
  subject: string;
  topics: string[];
  examType: string;
  examDisplayName?: string; // e.g., "SPSC Under Secretary" for proper titles
  userId: string;
  isPro: boolean;
  topicKey?: string; // e.g., "week-1-day-0" for back navigation
  planId?: string; // for restoring the correct plan when returning from view pages
  autoOpenNotebook?: boolean; // auto-open notebook when returning from viewer pages
  onClose: () => void;
}

type GenerationType = "mindmap" | "summary" | "flashcards" | "quiz" | "infographic" | "pyq" | "slides";
type UploadType = "youtube" | "image" | "pdf";

// Standard book recommendations per subject
const STANDARD_BOOKS: Record<string, { title: string; author: string; chapters: string[] }[]> = {
  // ENGINEERING - Civil Engineering
  "Mechanics of Material": [
    { title: "Strength of Materials", author: "R.K. Bansal", chapters: ["Simple Stresses & Strain", "Elastic Constants", "Shear Force", "Bending Moment", "Columns"] },
    { title: "Mechanics of Materials", author: "B.C. Punmia", chapters: ["Stress Analysis", "Strain", "Beams", "Torsion"] },
    { title: "GATE Civil Engineering", author: "Made Easy", chapters: ["SOM", "Structural Analysis", "RCC"] },
  ],
  "Structural Analysis": [
    { title: "Structural Analysis", author: "S.S. Bhavikatti", chapters: ["Determinate Structures", "Indeterminate Structures", "Influence Lines"] },
    { title: "Theory of Structures", author: "S. Ramamrutham", chapters: ["Analysis Methods", "Matrix Methods", "Moment Distribution"] },
  ],
  "Design of RCC Structures": [
    { title: "Reinforced Concrete Design", author: "N. Krishna Raju", chapters: ["Working Stress Method", "LSM", "Beams", "Slabs", "Columns", "Footings"] },
    { title: "Limit State Design", author: "Ashok K. Jain", chapters: ["IS 456", "Singly Reinforced", "Doubly Reinforced", "T-beams"] },
  ],
  "Fluid Mechanics": [
    { title: "Fluid Mechanics", author: "R.K. Bansal", chapters: ["Properties of Fluids", "Pressure", "Buoyancy", "Fluid Kinematics", "Flow Through Pipes"] },
    { title: "Hydraulics & Fluid Mechanics", author: "P.N. Modi & S.M. Seth", chapters: ["Bernoulli's Equation", "Flow Measurement", "Open Channel Flow"] },
  ],
  "Geotechnical Engineering": [
    { title: "Soil Mechanics", author: "B.C. Punmia", chapters: ["Soil Properties", "Permeability", "Compaction", "Shear Strength", "Earth Pressure"] },
    { title: "Soil Mechanics & Foundation Engineering", author: "K.R. Arora", chapters: ["Index Properties", "Consolidation", "Bearing Capacity", "Piles"] },
  ],
  "Surveying": [
    { title: "Surveying Vol 1 & 2", author: "B.C. Punmia", chapters: ["Chain Surveying", "Compass", "Levelling", "Theodolite", "Curves"] },
    { title: "Surveying & Levelling", author: "Kanetkar & Kulkarni", chapters: ["Linear Measurements", "Angular Measurements", "Contouring"] },
  ],
  "Transportation Engineering": [
    { title: "Highway Engineering", author: "S.K. Khanna & C.E.G. Justo", chapters: ["Geometric Design", "Pavement Design", "Traffic Engineering"] },
    { title: "Transportation Engineering", author: "Kadiyali", chapters: ["Highway Planning", "Materials", "Railway Engineering"] },
  ],
  "Environmental Engineering": [
    { title: "Environmental Engineering", author: "S.K. Garg", chapters: ["Water Supply", "Wastewater Treatment", "Air Pollution", "Solid Waste"] },
    { title: "Water Supply Engineering", author: "B.C. Punmia", chapters: ["Sources", "Treatment", "Distribution"] },
  ],
  "Construction Management": [
    { title: "Construction Planning & Management", author: "P.S. Gahlot & B.M. Dhir", chapters: ["CPM", "PERT", "Resource Management"] },
  ],
  // ENGINEERING - Mechanical Engineering
  "Engineering Mechanics": [
    { title: "Engineering Mechanics", author: "S.S. Bhavikatti", chapters: ["Statics", "Dynamics", "Friction", "Centroids", "Moment of Inertia"] },
    { title: "Engineering Mechanics", author: "R.K. Bansal", chapters: ["Force Systems", "Equilibrium", "Virtual Work"] },
  ],
  "Thermodynamics": [
    { title: "Engineering Thermodynamics", author: "P.K. Nag", chapters: ["Laws of Thermodynamics", "Entropy", "Gas Cycles", "Vapor Cycles"] },
    { title: "Thermal Engineering", author: "R.K. Rajput", chapters: ["IC Engines", "Gas Turbines", "Refrigeration", "Air Conditioning"] },
  ],
  "Machine Design": [
    { title: "Machine Design", author: "V.B. Bhandari", chapters: ["Design of Shafts", "Gears", "Bearings", "Springs", "Couplings"] },
    { title: "Design of Machine Elements", author: "Spotts", chapters: ["Stress Analysis", "Fatigue", "Design Calculations"] },
  ],
  "Manufacturing": [
    { title: "Manufacturing Technology", author: "P.N. Rao", chapters: ["Casting", "Welding", "Machining", "Sheet Metal", "Metrology"] },
    { title: "Production Technology", author: "R.K. Jain", chapters: ["Metal Forming", "Machine Tools", "CNC"] },
  ],
  // ENGINEERING - Electrical Engineering
  "Electrical Circuits": [
    { title: "Network Analysis", author: "Van Valkenburg", chapters: ["Network Theorems", "Transient Analysis", "AC Circuits"] },
    { title: "Circuit Theory", author: "A. Chakrabarti", chapters: ["KVL/KCL", "Mesh Analysis", "Nodal Analysis", "Resonance"] },
  ],
  "Electrical Machines": [
    { title: "Electrical Machines", author: "P.S. Bimbhra", chapters: ["DC Machines", "Transformers", "Induction Motors", "Synchronous Machines"] },
    { title: "Electric Machinery", author: "Fitzgerald", chapters: ["Electromechanical Conversion", "Machine Analysis"] },
  ],
  "Power Systems": [
    { title: "Power System Engineering", author: "I.J. Nagrath & D.P. Kothari", chapters: ["Load Flow", "Economic Dispatch", "Fault Analysis", "Stability"] },
    { title: "Electrical Power Systems", author: "C.L. Wadhwa", chapters: ["Transmission Lines", "Switchgear", "Protection"] },
  ],
  // ENGINEERING - Electronics Engineering
  "Electronic Devices": [
    { title: "Electronic Devices & Circuits", author: "Boylestad", chapters: ["Diodes", "BJT", "FET", "Amplifiers", "Op-Amps"] },
    { title: "Microelectronics", author: "Sedra & Smith", chapters: ["Semiconductor Physics", "Circuit Analysis"] },
  ],
  "Digital Electronics": [
    { title: "Digital Logic Design", author: "Morris Mano", chapters: ["Boolean Algebra", "Combinational Circuits", "Sequential Circuits", "Counters"] },
    { title: "Digital Electronics", author: "R.P. Jain", chapters: ["Number Systems", "Gates", "Flip-flops", "Memory"] },
  ],
  "Signals & Systems": [
    { title: "Signals & Systems", author: "Oppenheim", chapters: ["Fourier Transform", "Laplace Transform", "Z-Transform", "Sampling"] },
    { title: "Signals & Systems", author: "Nagoor Kani", chapters: ["Continuous Time", "Discrete Time", "LTI Systems"] },
  ],
  "Indian Polity": [
    { title: "Indian Polity", author: "M. Laxmikanth", chapters: ["Constitutional Framework", "Preamble", "Fundamental Rights", "DPSP", "Union Executive"] },
    { title: "Introduction to the Constitution of India", author: "D.D. Basu", chapters: ["Historical Background", "Salient Features", "Fundamental Rights"] },
  ],
  "Indian History": [
    { title: "India's Struggle for Independence", author: "Bipan Chandra", chapters: ["National Movement", "Freedom Struggle", "Revolt of 1857"] },
    { title: "A Brief History of Modern India", author: "Spectrum", chapters: ["British Rule", "Social Reforms", "Independence"] },
    { title: "Ancient and Medieval India", author: "Poonam Dalal Dahiya", chapters: ["Indus Valley", "Vedic Period", "Maurya Empire", "Mughal Empire"] },
  ],
  "Geography": [
    { title: "Certificate Physical and Human Geography", author: "G.C. Leong", chapters: ["Physical Geography", "Climatology", "Oceanography"] },
    { title: "Indian Geography", author: "Majid Husain", chapters: ["Physical Features", "Climate", "Agriculture", "Industries"] },
  ],
  "Indian Economy": [
    { title: "Indian Economy", author: "Ramesh Singh", chapters: ["Planning", "GDP", "Banking", "Fiscal Policy", "Agriculture"] },
    { title: "Indian Economy", author: "Sankarganesh Karuppiah", chapters: ["Economic Development", "Government Schemes", "Budget"] },
  ],
  "Environment": [
    { title: "Environment", author: "Shankar IAS", chapters: ["Ecology", "Biodiversity", "Climate Change", "Pollution", "Conservation"] },
  ],
  "Science": [
    { title: "Science & Technology", author: "TMH", chapters: ["Physics", "Chemistry", "Biology", "Space Technology", "Biotechnology"] },
  ],
  "Ethics": [
    { title: "Ethics, Integrity & Aptitude", author: "G. Subba Rao & P.N. Roy Chowdhury", chapters: ["Ethics Fundamentals", "Case Studies", "Public Administration Ethics"] },
    { title: "Lexicon for Ethics", author: "Niraj Kumar", chapters: ["Ethical Concepts", "Thinkers", "Applied Ethics"] },
  ],
  "Quantitative Aptitude": [
    { title: "Quantitative Aptitude", author: "R.S. Aggarwal", chapters: ["Number System", "Percentage", "Profit & Loss", "Time & Work"] },
    { title: "Fast Track Objective Arithmetic", author: "Rajesh Verma", chapters: ["Arithmetic", "Algebra", "Geometry"] },
  ],
  "Logical Reasoning": [
    { title: "A Modern Approach to Verbal & Non-Verbal Reasoning", author: "R.S. Aggarwal", chapters: ["Syllogism", "Blood Relations", "Coding-Decoding", "Series"] },
  ],
  "Current Affairs": [
    { title: "Yojana & Kurukshetra", author: "Government Publications", chapters: ["Monthly Issues", "Special Issues"] },
    { title: "India Year Book", author: "Government of India", chapters: ["All Chapters"] },
  ],
};

// Topic-specific government resources - matched by keywords in topic names
const TOPIC_SPECIFIC_RESOURCES: { keywords: string[]; resources: { title: string; url: string; description: string }[] }[] = [
  // POLITY - Specific topics
  {
    keywords: ["preamble", "constitutional framework"],
    resources: [
      { title: "Preamble - Constitution", url: "https://www.constitutionofindia.net/articles/preamble/", description: "Official Preamble text" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science" },
    ]
  },
  {
    keywords: ["fundamental rights", "right to equality", "right to freedom", "article 14", "article 19", "article 21"],
    resources: [
      { title: "Part III - Fundamental Rights", url: "https://www.constitutionofindia.net/parts/part-iii/", description: "Articles 12-35" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 2" },
    ]
  },
  {
    keywords: ["dpsp", "directive principles", "state policy"],
    resources: [
      { title: "Part IV - DPSP", url: "https://www.constitutionofindia.net/parts/part-iv/", description: "Articles 36-51" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science" },
    ]
  },
  {
    keywords: ["parliament", "lok sabha", "rajya sabha", "legislature", "union legislature"],
    resources: [
      { title: "Part V Ch II - Parliament", url: "https://www.constitutionofindia.net/parts/part-v/", description: "Articles 79-122" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 5" },
      { title: "Lok Sabha - Official", url: "https://sansad.in/ls/", description: "Lok Sabha website" },
    ]
  },
  {
    keywords: ["executive", "president", "prime minister", "council of ministers", "union executive"],
    resources: [
      { title: "Part V Ch I - Executive", url: "https://www.constitutionofindia.net/parts/part-v/", description: "Articles 52-78" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 4" },
      { title: "President of India", url: "https://presidentofindia.nic.in/", description: "Official website" },
    ]
  },
  {
    keywords: ["judiciary", "supreme court", "high court", "judicial review"],
    resources: [
      { title: "Part V Ch IV - Judiciary", url: "https://www.constitutionofindia.net/parts/part-v/", description: "Articles 124-147" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 6" },
      { title: "Supreme Court", url: "https://main.sci.gov.in/", description: "Official SC website" },
    ]
  },
  {
    keywords: ["federalism", "federal", "centre-state", "state relations", "schedules"],
    resources: [
      { title: "Part XI - Centre-State", url: "https://www.constitutionofindia.net/parts/part-xi/", description: "Articles 245-263" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 7" },
      { title: "7th Schedule - Lists", url: "https://www.constitutionofindia.net/schedules/list-i-union-list/", description: "Union, State, Concurrent Lists" },
    ]
  },
  {
    keywords: ["local government", "panchayat", "municipality", "73rd amendment", "74th amendment"],
    resources: [
      { title: "Part IX - Panchayats", url: "https://www.constitutionofindia.net/parts/part-ix/", description: "Articles 243-243O" },
      { title: "Part IXA - Municipalities", url: "https://www.constitutionofindia.net/parts/part-ixa/", description: "Articles 243P-243ZG" },
      { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science → Ch 8" },
    ]
  },
  {
    keywords: ["election", "electoral", "voting", "election commission"],
    resources: [
      { title: "Part XV - Elections", url: "https://www.constitutionofindia.net/parts/part-xv/", description: "Articles 324-329A" },
      { title: "Election Commission", url: "https://eci.gov.in/", description: "Official ECI website" },
    ]
  },
  {
    keywords: ["amendment", "constitutional amendment", "article 368"],
    resources: [
      { title: "Part XX - Amendment", url: "https://www.constitutionofindia.net/parts/part-xx/", description: "Article 368" },
      { title: "Part XX - Amendments", url: "https://www.constitutionofindia.net/parts/part-xx/", description: "Article 368 - Amendment procedure" },
    ]
  },
  // HISTORY - Specific topics
  {
    keywords: ["ancient india", "indus valley", "harappa", "vedic", "maurya", "gupta"],
    resources: [
      { title: "NCERT History", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → History" },
      { title: "ASI - Ancient Monuments", url: "https://asi.nic.in/alphabetical-list-of-monuments/", description: "Archaeological Survey" },
    ]
  },
  {
    keywords: ["medieval india", "delhi sultanate", "mughal", "vijayanagar", "bhakti"],
    resources: [
      { title: "NCERT History", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → History" },
      { title: "National Museum", url: "https://www.nationalmuseumindia.gov.in/", description: "Medieval artifacts" },
    ]
  },
  {
    keywords: ["modern india", "british", "colonialism", "revolt 1857", "national movement", "freedom struggle", "gandhi", "independence"],
    resources: [
      { title: "NCERT History", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → History" },
      { title: "National Archives", url: "https://nationalarchives.nic.in/", description: "Historical documents" },
      { title: "Gandhi Heritage Portal", url: "https://gandhiheritageportal.org/", description: "Gandhi's writings" },
    ]
  },
  // GEOGRAPHY - Specific topics
  {
    keywords: ["physical geography", "geomorphology", "landforms", "mountains", "plains", "plateau"],
    resources: [
      { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Geography" },
      { title: "GSI - Geological Survey", url: "https://www.gsi.gov.in/", description: "Geological data" },
    ]
  },
  {
    keywords: ["climate", "monsoon", "rainfall", "weather", "climatology"],
    resources: [
      { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Geography → Climate Ch" },
      { title: "IMD - Meteorology", url: "https://mausam.imd.gov.in/", description: "India Meteorological Dept" },
    ]
  },
  {
    keywords: ["population", "migration", "urbanization", "human geography", "settlement"],
    resources: [
      { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Geography" },
      { title: "Census of India", url: "https://censusindia.gov.in/", description: "Population data" },
    ]
  },
  {
    keywords: ["agriculture", "farming", "crops", "irrigation", "green revolution"],
    resources: [
      { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Geography Part II" },
      { title: "Agriculture Ministry", url: "https://agriwelfare.gov.in/", description: "Dept of Agriculture" },
    ]
  },
  {
    keywords: ["industry", "manufacturing", "industrial", "minerals", "resources"],
    resources: [
      { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Geography Part II" },
      { title: "Ministry of Industries", url: "https://dpiit.gov.in/", description: "Industrial Policy" },
    ]
  },
  // ECONOMY - Specific topics
  {
    keywords: ["gdp", "national income", "economic growth", "development"],
    resources: [
      { title: "Economic Survey Ch 1", url: "https://www.indiabudget.gov.in/economicsurvey/", description: "State of Economy" },
      { title: "NCERT Economics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Economics" },
    ]
  },
  {
    keywords: ["budget", "fiscal policy", "taxation", "gst", "deficit"],
    resources: [
      { title: "Union Budget", url: "https://www.indiabudget.gov.in/", description: "Budget documents" },
      { title: "NCERT Economics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Economics" },
      { title: "GST Portal", url: "https://www.gst.gov.in/", description: "GST information" },
    ]
  },
  {
    keywords: ["banking", "rbi", "monetary policy", "money supply", "inflation"],
    resources: [
      { title: "RBI Publications", url: "https://rbi.org.in/scripts/Publications.aspx", description: "RBI reports" },
      { title: "NCERT Economics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Economics" },
    ]
  },
  {
    keywords: ["planning", "five year plan", "niti aayog", "economic planning"],
    resources: [
      { title: "NITI Aayog", url: "https://niti.gov.in/", description: "Policy documents" },
      { title: "Economic Survey Ch 2", url: "https://www.indiabudget.gov.in/economicsurvey/", description: "Fiscal Developments" },
    ]
  },
  {
    keywords: ["poverty", "unemployment", "human development", "hdi", "social sector"],
    resources: [
      { title: "NCERT Economics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Economics" },
      { title: "UNDP HDR Data", url: "https://hdr.undp.org/data-center/human-development-index", description: "HDI Rankings & Data" },
    ]
  },
  // ENVIRONMENT - Specific topics
  {
    keywords: ["ecology", "ecosystem", "biodiversity", "species", "flora", "fauna"],
    resources: [
      { title: "NCERT Biology", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Biology" },
      { title: "MoEFCC", url: "https://moef.gov.in/", description: "Environment Ministry" },
      { title: "Wildlife Institute", url: "https://wii.gov.in/", description: "Wildlife research" },
    ]
  },
  {
    keywords: ["pollution", "air pollution", "water pollution", "waste management"],
    resources: [
      { title: "CPCB", url: "https://cpcb.nic.in/", description: "Central Pollution Control Board" },
      { title: "NCERT Biology", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Biology" },
    ]
  },
  {
    keywords: ["climate change", "global warming", "paris agreement", "cop", "carbon"],
    resources: [
      { title: "MoEFCC", url: "https://moef.gov.in/", description: "Climate & Environment Ministry" },
    ]
  },
  {
    keywords: ["forest", "conservation", "national park", "wildlife sanctuary", "protected area"],
    resources: [
      { title: "Forest Survey Report", url: "https://fsi.nic.in/", description: "Forest cover data" },
      { title: "National Parks List", url: "https://wii.gov.in/protected-area-network", description: "Protected areas" },
    ]
  },
  // SCIENCE - Specific topics
  {
    keywords: ["physics", "mechanics", "motion", "force", "energy"],
    resources: [
      { title: "NCERT Physics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11/12 → Physics" },
    ]
  },
  {
    keywords: ["optics", "light", "waves", "electromagnetic"],
    resources: [
      { title: "NCERT Physics", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Physics Part II" },
    ]
  },
  {
    keywords: ["chemistry", "chemical", "elements", "compounds", "reactions"],
    resources: [
      { title: "NCERT Chemistry", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11/12 → Chemistry" },
    ]
  },
  {
    keywords: ["biology", "cell", "genetics", "evolution", "human body"],
    resources: [
      { title: "NCERT Biology", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11/12 → Biology" },
    ]
  },
  {
    keywords: ["space", "isro", "satellite", "rocket", "mission"],
    resources: [
      { title: "ISRO", url: "https://www.isro.gov.in/", description: "Space missions" },
      { title: "ISRO Publications", url: "https://www.isro.gov.in/Publications.html", description: "Reports & documents" },
    ]
  },
  {
    keywords: ["nuclear", "atomic", "dae", "nuclear power"],
    resources: [
      { title: "DAE", url: "https://dae.gov.in/", description: "Atomic Energy Dept" },
    ]
  },
  {
    keywords: ["biotechnology", "dna", "genome", "genetic engineering"],
    resources: [
      { title: "DBT", url: "https://dbtindia.gov.in/", description: "Biotechnology Dept" },
      { title: "NCERT Biology", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Biology" },
    ]
  },
  // ETHICS
  {
    keywords: ["ethics", "integrity", "moral", "values", "aptitude"],
    resources: [
      { title: "2nd ARC 4th Report", url: "https://darpg.gov.in/sites/default/files/ethics4.pdf", description: "Ethics in Governance" },
      { title: "CVC Guidelines", url: "https://cvc.gov.in/", description: "Vigilance & anti-corruption" },
    ]
  },
  // CURRENT AFFAIRS
  {
    keywords: ["current affairs", "news", "recent", "latest"],
    resources: [
      { title: "PIB", url: "https://pib.gov.in/", description: "Press Information Bureau" },
      { title: "Yojana Magazine", url: "https://www.publicationsdivision.nic.in/index.php?route=product/journals", description: "Govt journals - Yojana/Kurukshetra" },
      { title: "India Year Book", url: "https://www.drishtiias.com/india-year-book", description: "Free chapter-wise navigator" },
    ]
  },
  // SIKKIM SPECIFIC
  {
    keywords: ["sikkim"],
    resources: [
      { title: "Sikkim Government", url: "https://sikkim.gov.in/", description: "State portal" },
      { title: "Sikkim Portal", url: "https://sikkim.gov.in/departments", description: "All departments & data" },
    ]
  },
  // QUANTITATIVE APTITUDE
  {
    keywords: ["arithmetic", "number", "percentage", "profit", "loss", "ratio", "proportion"],
    resources: [
      { title: "NCERT Maths", url: "https://ncert.nic.in/textbook.php", description: "Select Class 8/9/10 → Mathematics" },
    ]
  },
  {
    keywords: ["algebra", "equation", "quadratic", "linear"],
    resources: [
      { title: "NCERT Maths", url: "https://ncert.nic.in/textbook.php", description: "Select Class 10 → Mathematics" },
    ]
  },
  {
    keywords: ["geometry", "triangle", "circle", "mensuration", "area", "volume"],
    resources: [
      { title: "NCERT Maths", url: "https://ncert.nic.in/textbook.php", description: "Select Class 9/10 → Mathematics" },
    ]
  },
  {
    keywords: ["reasoning", "logical", "syllogism", "coding", "series", "analogy"],
    resources: [
      { title: "NCERT Logic", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Philosophy" },
    ]
  },
  // ENGINEERING - Civil Engineering
  {
    keywords: ["mechanics of material", "strength of material", "stress", "strain", "bending", "torsion", "som"],
    resources: [
      { title: "NPTEL - Strength of Materials", url: "https://nptel.ac.in/courses/105106049", description: "IIT Kharagpur video lectures" },
      { title: "SWAYAM - SOM", url: "https://swayam.gov.in/nd1_noc20_ce15", description: "Free certified course" },
      { title: "GATE Syllabus - Civil", url: "https://gate2025.iitr.ac.in/syllabus.html", description: "Official GATE syllabus" },
    ]
  },
  {
    keywords: ["structural analysis", "indeterminate", "moment distribution", "slope deflection", "matrix methods"],
    resources: [
      { title: "NPTEL - Structural Analysis I", url: "https://nptel.ac.in/courses/105106050", description: "IIT Kharagpur lectures" },
      { title: "NPTEL - Structural Analysis II", url: "https://nptel.ac.in/courses/105106051", description: "Advanced concepts" },
      { title: "IS 456:2000 - RCC Code", url: "https://bis.gov.in/", description: "Bureau of Indian Standards" },
    ]
  },
  {
    keywords: ["rcc", "reinforced concrete", "design of structures", "limit state", "working stress"],
    resources: [
      { title: "NPTEL - RCC Design", url: "https://nptel.ac.in/courses/105106052", description: "IIT Kharagpur lectures" },
      { title: "IS 456:2000", url: "https://bis.gov.in/", description: "Indian Standard for RCC" },
      { title: "SP 16:1980", url: "https://bis.gov.in/", description: "Design Aids for IS 456" },
    ]
  },
  {
    keywords: ["fluid mechanics", "hydraulics", "bernoulli", "flow", "pipe", "open channel"],
    resources: [
      { title: "NPTEL - Fluid Mechanics", url: "https://nptel.ac.in/courses/105101082", description: "IIT Madras lectures" },
      { title: "SWAYAM - Hydraulics", url: "https://swayam.gov.in/", description: "Search 'Fluid Mechanics'" },
      { title: "CWC - Water Resources", url: "http://cwc.gov.in/", description: "Central Water Commission data" },
    ]
  },
  {
    keywords: ["geotechnical", "soil mechanics", "foundation", "earth pressure", "bearing capacity", "consolidation"],
    resources: [
      { title: "NPTEL - Soil Mechanics", url: "https://nptel.ac.in/courses/105106045", description: "IIT Kharagpur lectures" },
      { title: "IS 1893 - Seismic", url: "https://bis.gov.in/", description: "Earthquake resistant design" },
      { title: "IS 6403 - Bearing Capacity", url: "https://bis.gov.in/", description: "Foundation design code" },
    ]
  },
  {
    keywords: ["surveying", "levelling", "theodolite", "contouring", "curves", "total station"],
    resources: [
      { title: "NPTEL - Surveying", url: "https://nptel.ac.in/courses/105107122", description: "IIT Roorkee lectures" },
      { title: "Survey of India", url: "https://surveyofindia.gov.in/", description: "Official surveying portal" },
    ]
  },
  {
    keywords: ["transportation", "highway", "pavement", "traffic", "geometric design", "railway"],
    resources: [
      { title: "NPTEL - Highway Engineering", url: "https://nptel.ac.in/courses/105101087", description: "IIT Madras lectures" },
      { title: "IRC Codes", url: "https://irc.nic.in/", description: "Indian Roads Congress standards" },
      { title: "MoRTH Specs", url: "https://morth.nic.in/", description: "Ministry road specifications" },
    ]
  },
  {
    keywords: ["environmental engineering", "water treatment", "wastewater", "sewage", "pollution control"],
    resources: [
      { title: "NPTEL - Environmental Engg", url: "https://nptel.ac.in/courses/105104102", description: "IIT Kanpur lectures" },
      { title: "CPCB Standards", url: "https://cpcb.nic.in/", description: "Pollution control standards" },
      { title: "IS 10500 - Drinking Water", url: "https://bis.gov.in/", description: "Water quality standards" },
    ]
  },
  // ENGINEERING - Mechanical Engineering
  {
    keywords: ["engineering mechanics", "statics", "dynamics", "kinematics", "kinetics"],
    resources: [
      { title: "NPTEL - Engineering Mechanics", url: "https://nptel.ac.in/courses/112104121", description: "IIT Kanpur lectures" },
      { title: "SWAYAM - Mechanics", url: "https://swayam.gov.in/", description: "Search 'Engineering Mechanics'" },
    ]
  },
  {
    keywords: ["thermodynamics", "heat transfer", "entropy", "cycles", "carnot", "refrigeration"],
    resources: [
      { title: "NPTEL - Thermodynamics", url: "https://nptel.ac.in/courses/112104113", description: "IIT Kanpur lectures" },
      { title: "NPTEL - Heat Transfer", url: "https://nptel.ac.in/courses/112101097", description: "IIT Madras lectures" },
      { title: "GATE Syllabus - Mechanical", url: "https://gate2025.iitr.ac.in/syllabus.html", description: "Official syllabus" },
    ]
  },
  {
    keywords: ["machine design", "shaft", "gear", "bearing", "spring", "coupling", "fatigue"],
    resources: [
      { title: "NPTEL - Machine Design", url: "https://nptel.ac.in/courses/112104121", description: "IIT Kanpur lectures" },
      { title: "IS 4460 - Gears", url: "https://bis.gov.in/", description: "Gear design standards" },
    ]
  },
  {
    keywords: ["manufacturing", "casting", "welding", "machining", "forming", "metrology"],
    resources: [
      { title: "NPTEL - Manufacturing", url: "https://nptel.ac.in/courses/112105127", description: "IIT Kharagpur lectures" },
      { title: "NPTEL - Metrology", url: "https://nptel.ac.in/courses/112104097", description: "IIT Kanpur lectures" },
    ]
  },
  {
    keywords: ["ic engine", "internal combustion", "otto", "diesel", "combustion"],
    resources: [
      { title: "NPTEL - IC Engines", url: "https://nptel.ac.in/courses/112104033", description: "IIT Kanpur lectures" },
      { title: "ARAI Standards", url: "https://www.araiindia.com/", description: "Automotive standards" },
    ]
  },
  // ENGINEERING - Electrical Engineering
  {
    keywords: ["electrical circuit", "network", "kirchhoff", "thevenin", "norton", "ac circuit", "dc circuit"],
    resources: [
      { title: "NPTEL - Circuit Theory", url: "https://nptel.ac.in/courses/108105066", description: "IIT Kharagpur lectures" },
      { title: "SWAYAM - Circuits", url: "https://swayam.gov.in/", description: "Search 'Electrical Circuits'" },
    ]
  },
  {
    keywords: ["electrical machine", "transformer", "induction motor", "synchronous", "dc machine"],
    resources: [
      { title: "NPTEL - Electrical Machines", url: "https://nptel.ac.in/courses/108105017", description: "IIT Kharagpur lectures" },
      { title: "NPTEL - Transformers", url: "https://nptel.ac.in/courses/108101092", description: "IIT Madras lectures" },
      { title: "IS 325 - Motors", url: "https://bis.gov.in/", description: "Motor specifications" },
    ]
  },
  {
    keywords: ["power system", "load flow", "fault analysis", "stability", "transmission", "protection"],
    resources: [
      { title: "NPTEL - Power Systems", url: "https://nptel.ac.in/courses/108101039", description: "IIT Madras lectures" },
      { title: "CEA Standards", url: "https://cea.nic.in/", description: "Central Electricity Authority" },
      { title: "Grid Code", url: "https://posoco.in/", description: "POSOCO grid standards" },
    ]
  },
  {
    keywords: ["control system", "transfer function", "root locus", "bode", "nyquist", "pid"],
    resources: [
      { title: "NPTEL - Control Systems", url: "https://nptel.ac.in/courses/108105063", description: "IIT Kharagpur lectures" },
    ]
  },
  // ENGINEERING - Electronics Engineering
  {
    keywords: ["electronic device", "diode", "transistor", "bjt", "mosfet", "amplifier", "op-amp"],
    resources: [
      { title: "NPTEL - Electronic Devices", url: "https://nptel.ac.in/courses/108101091", description: "IIT Madras lectures" },
      { title: "NPTEL - Analog Circuits", url: "https://nptel.ac.in/courses/108101057", description: "IIT Madras lectures" },
    ]
  },
  {
    keywords: ["digital electronics", "logic gate", "flip flop", "counter", "register", "boolean"],
    resources: [
      { title: "NPTEL - Digital Circuits", url: "https://nptel.ac.in/courses/108105132", description: "IIT Kharagpur lectures" },
      { title: "SWAYAM - Digital Electronics", url: "https://swayam.gov.in/", description: "Search 'Digital Electronics'" },
    ]
  },
  {
    keywords: ["signal", "fourier", "laplace", "z-transform", "sampling", "filter", "dsp"],
    resources: [
      { title: "NPTEL - Signals & Systems", url: "https://nptel.ac.in/courses/108101091", description: "IIT Madras lectures" },
      { title: "NPTEL - DSP", url: "https://nptel.ac.in/courses/117101055", description: "IIT Delhi lectures" },
    ]
  },
  {
    keywords: ["communication", "modulation", "antenna", "wireless", "microwave"],
    resources: [
      { title: "NPTEL - Communication", url: "https://nptel.ac.in/courses/117101055", description: "IIT Delhi lectures" },
      { title: "TRAI Standards", url: "https://trai.gov.in/", description: "Telecom regulations" },
    ]
  },
  // ENGINEERING - Computer Science
  {
    keywords: ["data structure", "algorithm", "sorting", "searching", "tree", "graph", "linked list"],
    resources: [
      { title: "NPTEL - Data Structures", url: "https://nptel.ac.in/courses/106102064", description: "IIT Guwahati lectures" },
      { title: "NPTEL - Algorithms", url: "https://nptel.ac.in/courses/106101060", description: "IIT Madras lectures" },
    ]
  },
  {
    keywords: ["database", "sql", "dbms", "normalization", "transaction"],
    resources: [
      { title: "NPTEL - DBMS", url: "https://nptel.ac.in/courses/106105175", description: "IIT Kharagpur lectures" },
    ]
  },
  {
    keywords: ["operating system", "process", "thread", "scheduling", "memory management", "deadlock"],
    resources: [
      { title: "NPTEL - Operating Systems", url: "https://nptel.ac.in/courses/106105175", description: "IIT Kharagpur lectures" },
    ]
  },
  {
    keywords: ["computer network", "tcp", "ip", "osi", "routing", "protocol"],
    resources: [
      { title: "NPTEL - Computer Networks", url: "https://nptel.ac.in/courses/106105081", description: "IIT Kharagpur lectures" },
    ]
  },
  // GATE General
  {
    keywords: ["gate", "ese", "engineering exam", "technical exam"],
    resources: [
      { title: "GATE Official", url: "https://gate2025.iitr.ac.in/", description: "Exam info & syllabus" },
      { title: "NPTEL Portal", url: "https://nptel.ac.in/", description: "All IIT video lectures" },
      { title: "SWAYAM", url: "https://swayam.gov.in/", description: "Free certified courses" },
    ]
  },
];

// Fallback subject-level resources (used when no topic match found)
const FALLBACK_RESOURCES: Record<string, { title: string; url: string; description: string }[]> = {
  "polity": [
    { title: "Constitution of India", url: "https://www.constitutionofindia.net/", description: "Full text" },
    { title: "NCERT Polity", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11 → Political Science" },
  ],
  "history": [
    { title: "NCERT History", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11/12 → History" },
    { title: "National Archives", url: "https://nationalarchives.nic.in/", description: "Historical documents" },
  ],
  "geography": [
    { title: "NCERT Geography", url: "https://ncert.nic.in/textbook.php", description: "Select Class 11/12 → Geography" },
    { title: "Census India", url: "https://censusindia.gov.in/", description: "Demographics" },
  ],
  "economy": [
    { title: "Economic Survey", url: "https://www.indiabudget.gov.in/economicsurvey/", description: "Annual survey" },
    { title: "RBI", url: "https://rbi.org.in/", description: "Banking & monetary" },
  ],
  "environment": [
    { title: "MoEFCC", url: "https://moef.gov.in/", description: "Environment Ministry" },
    { title: "NCERT Biology", url: "https://ncert.nic.in/textbook.php", description: "Select Class 12 → Biology" },
  ],
  "science": [
    { title: "NCERT Science", url: "https://ncert.nic.in/textbook.php", description: "Select Class 10 → Science" },
    { title: "ISRO", url: "https://www.isro.gov.in/", description: "Space Technology" },
  ],
  // ENGINEERING - Fallback resources
  "civil": [
    { title: "NPTEL Civil Engineering", url: "https://nptel.ac.in/course.html", description: "All Civil Engg courses" },
    { title: "Bureau of Indian Standards", url: "https://bis.gov.in/", description: "IS Codes for construction" },
    { title: "IRC - Roads Congress", url: "https://irc.nic.in/", description: "Highway & road standards" },
  ],
  "mechanical": [
    { title: "NPTEL Mechanical", url: "https://nptel.ac.in/course.html", description: "All Mechanical Engg courses" },
    { title: "BIS Standards", url: "https://bis.gov.in/", description: "Mechanical IS codes" },
  ],
  "electrical": [
    { title: "NPTEL Electrical", url: "https://nptel.ac.in/course.html", description: "All Electrical Engg courses" },
    { title: "CEA - Electricity Authority", url: "https://cea.nic.in/", description: "Power sector regulations" },
  ],
  "electronics": [
    { title: "NPTEL Electronics", url: "https://nptel.ac.in/course.html", description: "All EC/ECE courses" },
    { title: "TRAI Standards", url: "https://trai.gov.in/", description: "Telecom standards" },
  ],
  "computer": [
    { title: "NPTEL Computer Science", url: "https://nptel.ac.in/course.html", description: "All CS/IT courses" },
    { title: "SWAYAM - CS Courses", url: "https://swayam.gov.in/", description: "Free certified courses" },
  ],
  "engineering": [
    { title: "NPTEL Portal", url: "https://nptel.ac.in/", description: "IIT/IISc video lectures" },
    { title: "SWAYAM", url: "https://swayam.gov.in/", description: "Free govt. courses" },
    { title: "GATE Official", url: "https://gate2025.iitr.ac.in/", description: "Exam syllabus & info" },
  ],
  "default": [
    { title: "PIB", url: "https://pib.gov.in/", description: "Press Information Bureau" },
    { title: "India Year Book", url: "https://www.drishtiias.com/india-year-book", description: "Free chapter-wise navigator" },
  ],
};

interface UploadedContent {
  id: string;
  type: UploadType;
  name: string;
  url?: string;
  extractedText?: string;
  status: "uploading" | "processing" | "ready" | "error";
}

interface GeneratedContent {
  type: GenerationType;
  data: any;
  title: string;
}

const GENERATION_TYPES: { type: GenerationType; label: string; icon: any; color: string; bg: string }[] = [
  { type: "slides", label: "Slides", icon: Presentation, color: "text-cyan-400", bg: "bg-cyan-500/20" },
  { type: "pyq", label: "PYQ", icon: GraduationCap, color: "text-orange-400", bg: "bg-orange-500/20" },
  { type: "summary", label: "Summary", icon: FileText, color: "text-green-400", bg: "bg-green-500/20" },
  { type: "mindmap", label: "Mind Map", icon: Map, color: "text-blue-400", bg: "bg-blue-500/20" },
  { type: "flashcards", label: "Flashcards", icon: ListChecks, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  { type: "quiz", label: "Quiz", icon: HelpCircle, color: "text-purple-400", bg: "bg-purple-500/20" },
  { type: "infographic", label: "Infographic", icon: BarChart3, color: "text-red-400", bg: "bg-red-500/20" },
];

// Types that need uploaded content (shown below upload section)
const UPLOAD_GENERATION_TYPES: GenerationType[] = ["summary", "mindmap", "flashcards", "quiz", "infographic"];
// Types that work without uploads (shown in Generate Study Materials)
const AI_GENERATION_TYPES: GenerationType[] = ["slides", "pyq"];

export function TopicStudyPanel({
  subject,
  topics,
  examType,
  examDisplayName,
  userId,
  isPro,
  topicKey,
  planId,
  autoOpenNotebook,
  onClose,
}: TopicStudyPanelProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadedContent[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAddingYoutube, setIsAddingYoutube] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [generatingType, setGeneratingType] = useState<GenerationType | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [blurtMode, setBlurtMode] = useState(false);
  const [blurtText, setBlurtText] = useState("");
  const [analyzingBlurt, setAnalyzingBlurt] = useState(false);
  const [blurtAnalysis, setBlurtAnalysis] = useState<any>(null);
  const [blurtInputMode, setBlurtInputMode] = useState<"digital" | "paper">("digital");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [showGuidedLearning, setShowGuidedLearning] = useState(false);
  const [showNotebook, setShowNotebook] = useState(autoOpenNotebook ?? false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Create unique keys for storage based on topic
  const storageKey = `planner-uploads-${subject}-${topics.join("-")}`.replace(/\s+/g, "_").toLowerCase();
  const generatedStorageKey = `planner-generated-${subject}-${topics.join("-")}`.replace(/\s+/g, "_").toLowerCase();

  // Load uploads from localStorage on mount
  useEffect(() => {
    try {
      const savedUploads = localStorage.getItem(storageKey);
      if (savedUploads) {
        const parsed = JSON.parse(savedUploads) as UploadedContent[];
        // Only restore ready uploads (processing/error ones should be re-done)
        const readyUploads = parsed.filter(u => u.status === "ready");
        if (readyUploads.length > 0) {
          setUploads(readyUploads);
        }
      }
    } catch (error) {
      console.error("Failed to load uploads from localStorage:", error);
    }
  }, [storageKey]);

  // Load generated content from sessionStorage on mount
  useEffect(() => {
    try {
      const savedGenerated = sessionStorage.getItem(generatedStorageKey);
      if (savedGenerated) {
        const parsed = JSON.parse(savedGenerated) as GeneratedContent[];
        if (parsed.length > 0) {
          setGeneratedContent(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load generated content from sessionStorage:", error);
    }
  }, [generatedStorageKey]);

  // Save uploads to localStorage when they change
  const saveUploadsToStorage = useCallback((uploadsToSave: UploadedContent[]) => {
    try {
      // Only save ready uploads
      const readyUploads = uploadsToSave.filter(u => u.status === "ready");
      if (readyUploads.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(readyUploads));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error("Failed to save uploads to localStorage:", error);
    }
  }, [storageKey]);

  // Update localStorage whenever uploads change (for ready uploads)
  useEffect(() => {
    const readyUploads = uploads.filter(u => u.status === "ready");
    if (readyUploads.length > 0 || uploads.length === 0) {
      saveUploadsToStorage(uploads);
    }
  }, [uploads, saveUploadsToStorage]);

  // Save generated content to sessionStorage when it changes
  useEffect(() => {
    try {
      if (generatedContent.length > 0) {
        sessionStorage.setItem(generatedStorageKey, JSON.stringify(generatedContent));
      }
    } catch (error) {
      console.error("Failed to save generated content to sessionStorage:", error);
    }
  }, [generatedContent, generatedStorageKey]);

  // Track the content IDs to detect when NEW uploads are added
  const readyUploadIds = uploads.filter(u => u.status === "ready").map(u => u.id).sort().join(",");
  const prevUploadIdsRef = useRef<string | null>(null); // null means not yet initialized
  const storageLoadCompleteRef = useRef(false);

  // Mark storage load as complete after the initial load effects run
  useEffect(() => {
    // Wait a tick to ensure both storage load effects have run
    const timer = setTimeout(() => {
      storageLoadCompleteRef.current = true;
      prevUploadIdsRef.current = readyUploadIds;
    }, 100);
    return () => clearTimeout(timer);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear generated content ONLY when new content is uploaded (not on initial load or removal)
  useEffect(() => {
    // Don't run until storage load is complete
    if (!storageLoadCompleteRef.current || prevUploadIdsRef.current === null) {
      return;
    }

    const prevIds = prevUploadIdsRef.current.split(",").filter(Boolean);
    const currentIds = readyUploadIds.split(",").filter(Boolean);

    // Check if NEW content was added (not just removed or unchanged)
    const hasNewContent = currentIds.some(id => !prevIds.includes(id));

    if (hasNewContent && generatedContent.length > 0) {
      console.log("New content uploaded, clearing old generated content");
      setGeneratedContent([]);
      sessionStorage.removeItem(generatedStorageKey);
    }

    prevUploadIdsRef.current = readyUploadIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyUploadIds]);

  // Handle YouTube URL addition
  const handleAddYoutube = async () => {
    if (!youtubeUrl.trim()) return;

    const videoId = extractYoutubeId(youtubeUrl);
    if (!videoId) {
      toast.error("Invalid YouTube URL");
      return;
    }

    setIsAddingYoutube(true);
    const uploadId = `yt-${Date.now()}`;

    setUploads(prev => [...prev, {
      id: uploadId,
      type: "youtube",
      name: "YouTube Video",
      url: youtubeUrl,
      status: "processing",
    }]);

    try {
      const response = await fetch("/api/study-ai/parse-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "youtube",
          url: youtubeUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transcript");
      }

      const data = await response.json();

      setUploads(prev => prev.map(u =>
        u.id === uploadId
          ? { ...u, name: data.title || "YouTube Video", extractedText: data.text, status: "ready" }
          : u
      ));

      setYoutubeUrl("");
      toast.success("YouTube transcript extracted!");
    } catch (error) {
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, status: "error" } : u
      ));
      toast.error("Failed to extract YouTube transcript");
    } finally {
      setIsAddingYoutube(false);
    }
  };

  // Handle file upload (PDF or Image)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "image") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadId = `file-${Date.now()}`;

    setUploads(prev => [...prev, {
      id: uploadId,
      type,
      name: file.name,
      status: "processing",
    }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch("/api/study-ai/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process file");
      }

      const data = await response.json();

      setUploads(prev => prev.map(u =>
        u.id === uploadId
          ? { ...u, extractedText: data.text, status: "ready" }
          : u
      ));

      toast.success(`${type === "pdf" ? "PDF" : "Image"} text extracted!`);
    } catch (error) {
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, status: "error" } : u
      ));
      toast.error(`Failed to process ${type}`);
    }

    // Reset input
    if (type === "pdf" && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (type === "image" && imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const extractYoutubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const getSourceContent = (): string => {
    const readyUploads = uploads.filter(u => u.status === "ready" && u.extractedText);
    if (readyUploads.length === 0) return "";

    return readyUploads
      .map(u => `=== SOURCE: ${u.type.toUpperCase()} - ${u.name} ===\n${u.extractedText}`)
      .join("\n\n");
  };

  // Navigate to full view for a generation type
  const navigateToFullView = (type: GenerationType, content: any, title: string) => {
    const baseData = { subject, topics, topicKey, planId, examType, examDisplayName };

    switch (type) {
      case "mindmap":
        sessionStorage.setItem("planner-mindmap-data", JSON.stringify({
          markdown: content.markdown,
          title,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/mindmap");
        break;
      case "summary":
        sessionStorage.setItem("planner-summary-data", JSON.stringify({
          title,
          keyPoints: content.keyPoints,
          keyDates: content.keyDates,
          keyConcepts: content.keyConcepts,
          examFacts: content.examFacts,
          conclusion: content.conclusion,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/summary");
        break;
      case "flashcards":
        sessionStorage.setItem("planner-flashcards-data", JSON.stringify({
          title,
          cards: content.cards,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/flashcards");
        break;
      case "quiz":
        sessionStorage.setItem("planner-quiz-data", JSON.stringify({
          title,
          questions: content.questions,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/quiz");
        break;
      case "infographic":
        sessionStorage.setItem("planner-infographic-data", JSON.stringify({
          title,
          keyFacts: content.keyFacts,
          highlights: content.highlights,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/infographic");
        break;
      case "pyq":
        sessionStorage.setItem("planner-pyq-data", JSON.stringify({
          title,
          questions: content.questions,
          realCount: content.realCount || 0,
          aiCount: content.aiCount || 0,
          generationCount: 0, // Initial generation
          ...baseData,
        }));
        router.push("/study-ai/planner/view/pyq");
        break;
      case "slides":
        sessionStorage.setItem("planner-slides-data", JSON.stringify({
          title,
          slides: content.slides,
          themeColor: content.themeColor,
          ...baseData,
        }));
        router.push("/study-ai/planner/view/slides");
        break;
    }
  };

  // Get relevant books for the current subject
  const getRelevantBooks = () => {
    const subjectLower = subject.toLowerCase();
    const topicsLower = topics.join(" ").toLowerCase();
    const searchText = `${subjectLower} ${topicsLower}`;

    // Match subject to book categories (exact/substring match only)
    for (const [category, books] of Object.entries(STANDARD_BOOKS)) {
      if (subjectLower.includes(category.toLowerCase())) {
        // Filter chapters relevant to current topics
        return books.map(book => ({
          ...book,
          relevantChapters: book.chapters.filter(ch =>
            topics.some(t =>
              ch.toLowerCase().includes(t.toLowerCase().split(" ")[0]) ||
              t.toLowerCase().includes(ch.toLowerCase().split(" ")[0])
            )
          ).slice(0, 3),
        }));
      }
    }

    // Try partial matches
    if (subjectLower.includes("polity") || subjectLower.includes("constitution")) {
      return STANDARD_BOOKS["Indian Polity"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("history")) {
      return STANDARD_BOOKS["Indian History"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("geography") || subjectLower.includes("geo")) {
      return STANDARD_BOOKS["Geography"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("economy") || subjectLower.includes("economic")) {
      return STANDARD_BOOKS["Indian Economy"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("environment") || subjectLower.includes("ecology")) {
      return STANDARD_BOOKS["Environment"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("science") || subjectLower.includes("physics") || subjectLower.includes("chemistry") || subjectLower.includes("biology")) {
      return STANDARD_BOOKS["Science"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("ethics") || subjectLower.includes("integrity")) {
      return STANDARD_BOOKS["Ethics"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("quant") || subjectLower.includes("arithmetic") || subjectLower.includes("math")) {
      return STANDARD_BOOKS["Quantitative Aptitude"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("reasoning") || subjectLower.includes("logical")) {
      return STANDARD_BOOKS["Logical Reasoning"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (subjectLower.includes("current") || subjectLower.includes("affairs")) {
      return STANDARD_BOOKS["Current Affairs"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }

    // ENGINEERING - Civil Engineering
    if (searchText.includes("mechanics of material") || searchText.includes("strength of material") || searchText.includes("som") || searchText.includes("stress") || searchText.includes("strain")) {
      return STANDARD_BOOKS["Mechanics of Material"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("structural") || searchText.includes("analysis") || searchText.includes("moment distribution")) {
      return STANDARD_BOOKS["Structural Analysis"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("rcc") || searchText.includes("reinforced") || searchText.includes("concrete design")) {
      return STANDARD_BOOKS["Design of RCC Structures"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("fluid") || searchText.includes("hydraulic") || searchText.includes("bernoulli")) {
      return STANDARD_BOOKS["Fluid Mechanics"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("geotechnical") || searchText.includes("soil") || searchText.includes("foundation")) {
      return STANDARD_BOOKS["Geotechnical Engineering"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("survey") || searchText.includes("levelling") || searchText.includes("theodolite")) {
      return STANDARD_BOOKS["Surveying"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("transportation") || searchText.includes("highway") || searchText.includes("pavement") || searchText.includes("traffic")) {
      return STANDARD_BOOKS["Transportation Engineering"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("environmental engineering") || searchText.includes("water treatment") || searchText.includes("sewage")) {
      return STANDARD_BOOKS["Environmental Engineering"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }

    // ENGINEERING - Mechanical Engineering
    if (searchText.includes("engineering mechanics") || searchText.includes("statics") || searchText.includes("dynamics")) {
      return STANDARD_BOOKS["Engineering Mechanics"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("thermodynamics") || searchText.includes("heat transfer") || searchText.includes("entropy")) {
      return STANDARD_BOOKS["Thermodynamics"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("machine design") || searchText.includes("shaft") || searchText.includes("gear") || searchText.includes("bearing")) {
      return STANDARD_BOOKS["Machine Design"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("manufacturing") || searchText.includes("casting") || searchText.includes("welding") || searchText.includes("machining")) {
      return STANDARD_BOOKS["Manufacturing"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }

    // ENGINEERING - Electrical Engineering
    if (searchText.includes("electrical circuit") || searchText.includes("network") || searchText.includes("kirchhoff")) {
      return STANDARD_BOOKS["Electrical Circuits"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("electrical machine") || searchText.includes("transformer") || searchText.includes("motor") || searchText.includes("induction")) {
      return STANDARD_BOOKS["Electrical Machines"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("power system") || searchText.includes("load flow") || searchText.includes("transmission")) {
      return STANDARD_BOOKS["Power Systems"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }

    // ENGINEERING - Electronics Engineering
    if (searchText.includes("electronic device") || searchText.includes("transistor") || searchText.includes("amplifier") || searchText.includes("op-amp")) {
      return STANDARD_BOOKS["Electronic Devices"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("digital") || searchText.includes("logic gate") || searchText.includes("flip flop") || searchText.includes("boolean")) {
      return STANDARD_BOOKS["Digital Electronics"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }
    if (searchText.includes("signal") || searchText.includes("fourier") || searchText.includes("laplace") || searchText.includes("dsp")) {
      return STANDARD_BOOKS["Signals & Systems"]?.map(b => ({ ...b, relevantChapters: b.chapters.slice(0, 3) })) || [];
    }

    return [];
  };

  // Get relevant free government resources based on SPECIFIC TOPICS
  const getRelevantFreeResources = () => {
    const searchText = `${subject} ${topics.join(" ")}`.toLowerCase();
    const matchedResources: { title: string; url: string; description: string }[] = [];

    // First: Find topic-specific matches (most relevant)
    for (const entry of TOPIC_SPECIFIC_RESOURCES) {
      const matchScore = entry.keywords.filter(kw => searchText.includes(kw)).length;
      if (matchScore > 0) {
        // Add resources with their match score for sorting
        entry.resources.forEach(r => {
          if (!matchedResources.some(mr => mr.url === r.url)) {
            matchedResources.push(r);
          }
        });
      }
    }

    // If we found topic-specific matches, return them
    if (matchedResources.length > 0) {
      return matchedResources.slice(0, 3);
    }

    // Fallback: Use subject-level resources
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes("polity") || subjectLower.includes("constitution")) {
      return FALLBACK_RESOURCES["polity"] || [];
    }
    if (subjectLower.includes("history")) {
      return FALLBACK_RESOURCES["history"] || [];
    }
    if (subjectLower.includes("geography") || subjectLower.includes("geo")) {
      return FALLBACK_RESOURCES["geography"] || [];
    }
    if (subjectLower.includes("economy") || subjectLower.includes("economic")) {
      return FALLBACK_RESOURCES["economy"] || [];
    }
    if (subjectLower.includes("environment") || subjectLower.includes("ecology")) {
      return FALLBACK_RESOURCES["environment"] || [];
    }
    if (subjectLower.includes("science") || subjectLower.includes("physics") || subjectLower.includes("chemistry") || subjectLower.includes("biology")) {
      return FALLBACK_RESOURCES["science"] || [];
    }

    // ENGINEERING Fallbacks
    if (subjectLower.includes("civil") || subjectLower.includes("structural") || subjectLower.includes("construction")) {
      return FALLBACK_RESOURCES["civil"] || [];
    }
    if (subjectLower.includes("mechanical") || subjectLower.includes("thermal") || subjectLower.includes("machine")) {
      return FALLBACK_RESOURCES["mechanical"] || [];
    }
    if (subjectLower.includes("electrical") || subjectLower.includes("power")) {
      return FALLBACK_RESOURCES["electrical"] || [];
    }
    if (subjectLower.includes("electronics") || subjectLower.includes("communication") || subjectLower.includes("ece") || subjectLower.includes("ec")) {
      return FALLBACK_RESOURCES["electronics"] || [];
    }
    if (subjectLower.includes("computer") || subjectLower.includes("software") || subjectLower.includes("cse") || subjectLower.includes("cs") || subjectLower.includes("it")) {
      return FALLBACK_RESOURCES["computer"] || [];
    }
    if (subjectLower.includes("engineering") || subjectLower.includes("gate") || subjectLower.includes("ese") || subjectLower.includes("technical")) {
      return FALLBACK_RESOURCES["engineering"] || [];
    }

    return FALLBACK_RESOURCES["default"] || [];
  };

  const relevantBooks = getRelevantBooks();
  const relevantFreeResources = getRelevantFreeResources();

  const handleGenerate = async (type: GenerationType) => {
    const sourceContent = getSourceContent();

    // PYQ can generate without source content (uses AI knowledge of UPSC questions)
    if (!sourceContent && type !== "pyq" && type !== "slides") {
      toast.error("Please upload some content first (YouTube, PDF, or Image)");
      return;
    }

    if (generatingType) return;

    setGeneratingType(type);
    try {
      const supabase = createClient();

      // Use invoke() — automatically adds Authorization + apikey headers and handles token refresh
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-topic-content",
        {
          body: {
            subject,
            topics,
            examType,
            examDisplayName: examDisplayName || undefined,
            generationType: type,
            sourceContent: sourceContent || null,
          },
        }
      );

      if (fnError) {
        // Try to extract the actual error body from the edge function response
        let actualError = fnError.message || "Failed to generate content";
        try {
          const errorBody = await (fnError as unknown as { context: Response }).context?.json?.();
          if (errorBody?.error) actualError = errorBody.error;
        } catch { /* fall through to generic message */ }
        throw new Error(actualError);
      }

      // Store in generatedContent for quick re-access
      setGeneratedContent(prev => {
        const filtered = prev.filter(c => c.type !== type);
        return [...filtered, { type, data: data.content, title: data.title }];
      });

      // Navigate directly to full view
      navigateToFullView(type, data.content, data.title);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate content");
    } finally {
      setGeneratingType(null);
    }
  };

  const handleBlurtSubmit = async () => {
    if (!blurtText.trim()) {
      toast.error("Please write something first");
      return;
    }

    setAnalyzingBlurt(true);
    try {
      const response = await fetch("/api/study-ai/analyze-topic-blurt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topics,
          examType,
          userInput: blurtText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze");
      }

      const data = await response.json();
      setBlurtAnalysis(data.analysis);
      toast.success("Analysis complete!");
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze");
    } finally {
      setAnalyzingBlurt(false);
    }
  };

  const getContentByType = (type: GenerationType) => {
    return generatedContent.find(c => c.type === type);
  };

  const hasReadyContent = uploads.some(u => u.status === "ready");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            {subject}
          </h3>
          <p className="text-xs text-white/50 mt-0.5">{topics.join(", ")}</p>
        </div>
      </div>

      {/* Notebook & Guided Learning buttons */}
      {!showNotebook && !showGuidedLearning && (
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => setShowNotebook(true)}
            className="relative p-4 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 hover:from-violet-500/30 hover:to-indigo-500/30 transition-all text-left overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-violet-400/15 to-indigo-400/15 blur-xl"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div className="absolute top-2 right-3" animate={{ y: [-2, 2, -2], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}>
              <Sparkles className="w-2.5 h-2.5 text-violet-300" />
            </motion.div>
            <div className="relative flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/40 to-indigo-500/40 flex items-center justify-center border border-violet-400/30 shadow-lg shadow-violet-500/20"
                animate={{ boxShadow: ["0 0 15px rgba(139, 92, 246, 0.2)", "0 0 25px rgba(99, 102, 241, 0.3)", "0 0 15px rgba(139, 92, 246, 0.2)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <BookMarked className="w-5 h-5 text-violet-300" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-violet-200">Notebook</span>
                <p className="text-[10px] text-white/50 mt-0.5">Sources &bull; Notes &bull; Chat</p>
              </div>
            </div>
          </motion.button>

          <motion.button
            onClick={() => setShowGuidedLearning(true)}
            className="relative p-4 rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all text-left overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-cyan-400/15 to-purple-400/15 blur-xl"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div className="absolute top-2 right-3" animate={{ y: [-2, 2, -2], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
            </motion.div>
            <motion.div className="absolute bottom-3 right-6" animate={{ y: [2, -2, 2], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>
              <Sparkles className="w-2 h-2 text-cyan-300" />
            </motion.div>
            <div className="relative flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center border border-cyan-400/30 shadow-lg shadow-cyan-500/20"
                animate={{ boxShadow: ["0 0 15px rgba(34, 211, 238, 0.2)", "0 0 25px rgba(168, 85, 247, 0.3)", "0 0 15px rgba(34, 211, 238, 0.2)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <GraduationCap className="w-5 h-5 text-cyan-300" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">Guided Learning</span>
                <p className="text-[10px] text-white/50 mt-0.5">Socratic tutoring &bull; AI Tutor</p>
              </div>
            </div>
          </motion.button>
        </div>
      )}

      {/* Notebook expanded */}
      {showNotebook && !showGuidedLearning && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-violet-300 flex items-center gap-2">
              <BookMarked className="w-4 h-4" />
              Notebook
            </h4>
            <button
              onClick={() => setShowNotebook(false)}
              className="text-xs text-white/40 hover:text-white/60"
            >
              Close
            </button>
          </div>
          <NotebookTab topicList={topics.map(t => `${subject} - ${t}`)} subject={subject} topics={topics} examType={examType} planId={planId} topicKey={topicKey} recommendedBooks={relevantBooks} freeResources={relevantFreeResources} />
        </motion.div>
      )}

      {/* Guided Learning expanded */}
      {showGuidedLearning && !showNotebook && (
        <GuidedLearningChat
          plannerContext={{
            planId: topicKey || `${subject}-${topics.join("-")}`,
            subject,
            topics,
            examType,
          }}
          userId={userId}
          isPro={isPro}
          onSessionComplete={() => setShowGuidedLearning(false)}
          onClose={() => setShowGuidedLearning(false)}
          maxHeight="400px"
        />
      )}

      {/* AI Generate Study Materials */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-white">Generate Study Materials</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {GENERATION_TYPES.filter(g => AI_GENERATION_TYPES.includes(g.type)).map(({ type, label, icon: Icon, color, bg }) => {
              const isGenerated = getContentByType(type);
              const isGenerating = generatingType === type;

              const handleClick = () => {
                if (isGenerated) {
                  navigateToFullView(type, isGenerated.data, isGenerated.title);
                } else {
                  handleGenerate(type);
                }
              };

              return (
                <button
                  key={type}
                  onClick={handleClick}
                  disabled={generatingType !== null && generatingType !== type}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", bg)}>
                    {isGenerating ? (
                      <Loader2 className="w-4.5 h-4.5 text-primary animate-spin" />
                    ) : (
                      <Icon className={cn("w-4.5 h-4.5", color)} />
                    )}
                  </div>
                  <span className="text-sm font-medium text-white/80">{label}</span>
                </button>
              );
            })}
          </div>
      </div>

      {/* Generated Materials List - Shows content generated in this session */}
      {generatedContent.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/60" />
            <span className="text-sm font-medium text-white">Generated This Session</span>
            <span className="text-xs text-white/40">({generatedContent.length})</span>
          </div>

          <div className="space-y-2">
            {generatedContent.map(({ type, data, title }) => {
              const config = GENERATION_TYPES.find(g => g.type === type);
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      config.bg
                    )}>
                      <Icon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{title}</p>
                      <p className="text-xs text-white/40">{config.label} • Just now</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToFullView(type, data, title)}
                    className="h-8 px-3 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    View
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-white/50 text-center">
            💡 Click &quot;View&quot; to see full content and save to your library
          </p>
        </div>
      )}

      {/* Blurting Section */}
      <div className="border-t border-white/10 pt-3">
        <button
          onClick={() => setBlurtMode(!blurtMode)}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          <PenLine className="w-4 h-4 text-orange-400" />
          <span>Active Recall (Blurting)</span>
          {blurtMode ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {blurtMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3">
                <p className="text-xs text-white/50">
                  Write everything you know about this topic without looking at notes.
                </p>

                {/* Type / Paper Tabs */}
                <Tabs
                  value={blurtInputMode}
                  onValueChange={(v) => setBlurtInputMode(v as "digital" | "paper")}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-2 bg-white/5 p-1 rounded-xl h-9">
                    <TabsTrigger
                      value="digital"
                      className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white/10"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      Type
                    </TabsTrigger>
                    <TabsTrigger
                      value="paper"
                      className="flex items-center gap-1.5 text-xs data-[state=active]:bg-white/10"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Paper
                      {!isPro && <Crown className="w-3 h-3 text-orange-400" />}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="digital" className="mt-3 space-y-3">
                    <Textarea
                      value={blurtText}
                      onChange={(e) => setBlurtText(e.target.value)}
                      placeholder={`Write what you know about ${subject}...`}
                      className="bg-white/5 border-white/10 text-white min-h-[100px] text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/40">
                        {blurtText.length} chars • {blurtText.split(/\s+/).filter(Boolean).length} words
                      </p>
                      <div className="flex items-center gap-2">
                        <VoiceInput
                          onTranscript={(text) => setBlurtText((prev) => prev ? prev + " " + text : text)}
                          disabled={analyzingBlurt}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        />
                        <Button
                          onClick={handleBlurtSubmit}
                          disabled={analyzingBlurt || !blurtText.trim()}
                          className="bg-orange-500 hover:bg-orange-600"
                          size="sm"
                        >
                          {analyzingBlurt ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Analyze
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="paper" className="mt-3 space-y-3">
                    <PaperBlurtUpload
                      isPro={isPro}
                      onTextExtracted={(text) => {
                        setBlurtText(text);
                        setBlurtInputMode("digital");
                        toast.success("Text extracted! Review and analyze.");
                      }}
                      onProRequired={() => setUpgradeModalOpen(true)}
                    />
                    {blurtText && blurtInputMode === "paper" && (
                      <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-white/5">
                          <h4 className="font-medium text-xs text-white/50 mb-1.5">
                            Extracted Text:
                          </h4>
                          <p className="text-sm text-white/80 whitespace-pre-wrap line-clamp-4">
                            {blurtText}
                          </p>
                        </div>
                        <Button
                          onClick={handleBlurtSubmit}
                          disabled={analyzingBlurt || !blurtText.trim()}
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          size="sm"
                        >
                          {analyzingBlurt ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Analyze Notes
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {blurtAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Results</h4>
                      <span className="text-xl font-bold text-orange-400">{blurtAnalysis.score}%</span>
                    </div>

                    {blurtAnalysis.strengths?.length > 0 && (
                      <div>
                        <p className="text-xs text-green-400 mb-1">Correct:</p>
                        <ul className="text-xs text-white/70 space-y-0.5">
                          {blurtAnalysis.strengths.slice(0, 3).map((s: string, i: number) => (
                            <li key={i}>✓ {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {blurtAnalysis.gaps?.length > 0 && (
                      <div>
                        <p className="text-xs text-red-400 mb-1">Gaps:</p>
                        <ul className="text-xs text-white/70 space-y-0.5">
                          {blurtAnalysis.gaps.slice(0, 3).map((g: string, i: number) => (
                            <li key={i}>✗ {g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
    </div>
  );
}
