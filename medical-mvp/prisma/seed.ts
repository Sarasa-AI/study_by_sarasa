import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedQuestion = {
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string;
  explanation: string;
  points: number;
  orderIndex: number;
};

type SeedCase = {
  categoryId: string;
  title: string;
  patientInfo: string;
  mediaUrl: string | null;
  mediaType: string | null;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  managementPoints: string[];
  keyNotes: string;
  questions: SeedQuestion[];
};

function extractChiefComplaint(patientInfo: string): string {
  try {
    const parsed = JSON.parse(patientInfo) as { chiefComplaint?: string };
    return parsed.chiefComplaint?.trim() || "نامشخص";
  } catch {
    return "نامشخص";
  }
}

function toCaseFields(c: SeedCase) {
  return {
    chiefComplaint: extractChiefComplaint(c.patientInfo),
    management: c.managementPoints.join("\n"),
    teachingPoints: c.keyNotes ? [c.keyNotes] : [],
  };
}

function toQuestionCreateData(q: SeedQuestion) {
  return {
    questionText: q.questionText,
    optionA: q.options.A,
    optionB: q.options.B,
    optionC: q.options.C,
    optionD: q.options.D,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    points: q.points,
    orderIndex: q.orderIndex,
  };
}

async function main() {
  // Clean up existing data to make seeding idempotent in dev
  await prisma.quizResult.deleteMany({});
  await prisma.userProgress.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});

  const categories = await prisma.category.createMany({
    data: [
      { name: "قلب و عروق", slug: "cardiology", description: "اورژانس‌های قلبی", icon: "❤️", orderIndex: 1 },
      { name: "ریه", slug: "pulmonology", description: "اورژانس‌های تنفسی", icon: "🫁", orderIndex: 2 },
      { name: "نورولوژی", slug: "neurology", description: "اورژانس‌های عصبی", icon: "🧠", orderIndex: 3 },
      { name: "گوارش", slug: "gastroenterology", description: "اورژانس‌های شکمی", icon: "🫃", orderIndex: 4 },
      { name: "تروما", slug: "trauma", description: "آسیب‌ها و تروما", icon: "🩸", orderIndex: 5 },
      { name: "توکسیکولوژی", slug: "toxicology", description: "مسمومیت‌ها", icon: "☠️", orderIndex: 6 },
      { name: "عفونی", slug: "infectious", description: "عفونت‌های حاد", icon: "🦠", orderIndex: 7 },
      { name: "زنان و زایمان", slug: "obstetrics", description: "اورژانس‌های زنان", icon: "🤰", orderIndex: 8 },
      { name: "اطفال", slug: "pediatrics", description: "اورژانس‌های کودکان", icon: "🧒", orderIndex: 9 },
      { name: "کلیه", slug: "nephrology", description: "اورژانس‌های کلیوی", icon: "🧪", orderIndex: 10 },
    ],
  });

  const catList = await prisma.category.findMany({ orderBy: { orderIndex: "asc" } });
  const getCat = (slug: string) => catList.find((c) => c.slug === slug)!;

  // Define 10 sample cases across categories
  const casesData = [
    {
      categoryId: getCat("cardiology").id,
      title: "CP با ST Elevation",
      patientInfo: JSON.stringify({ age: 58, gender: "M", chiefComplaint: "درد قفسه سینه 30 دقیقه" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/stemi.png",
      mediaType: "IMAGE",
      symptoms: ["تعریق", "تهوع", "درد منتشر به بازو"],
      diagnosis: "STEMI",
      differentialDiagnosis: ["NSTEMI", "آنژین ناپایدار", "پریکاردیت", "دیس‌سکشن آئورت"],
      managementPoints: ["MONA-B", "آمادگی برای PCI فوری", "آسپیرین 325mg", "هپارین"],
      keyNotes: "EKG با ST elevation در II, III, aVF",
      questions: [
        {
          questionText: "اولین اقدام حیاتی چیست؟",
          options: { A: "اکسیژن وریدی", B: "آسپیرین جویدنی", C: "نیتروگلیسیرین زیرزبانی", D: "مورفین" },
          correctAnswer: "B",
          explanation: "آسپیرین کاهش مرگ‌ومیر؛ MONA-B ترتیب.",
          points: 2,
          orderIndex: 1,
        },
        {
          questionText: "کدام لیدها ST elevation دارند؟",
          options: { A: "V1-V4", B: "II, III, aVF", C: "I, aVL", D: "V5-V6" },
          correctAnswer: "B",
          explanation: "الگوی MI تحتانی.",
          points: 1,
          orderIndex: 2,
        },
      ],
    },
    {
      categoryId: getCat("pulmonology").id,
      title: "SOB ناگهانی بعد جراحی",
      patientInfo: JSON.stringify({ age: 42, gender: "F", chiefComplaint: "تنگی نفس و درد پلوریتیک" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/pe_cta.png",
      mediaType: "IMAGE",
      symptoms: ["تاکی‌کاردی", "هیپوکسی", "درد پلوریتیک"],
      diagnosis: "Pulmonary Embolism",
      differentialDiagnosis: ["پنومونیا", "پنوموتوراکس", "MI"],
      managementPoints: ["CTA قفسه سینه", "هپارین", "ارزیابی DVT"],
      keyNotes: "ریسک PE بعد بی‌حرکتی",
      questions: [
        {
          questionText: "کدام فاکتور ریسک برجسته است؟",
          options: { A: "سیگار", B: "بی‌حرکتی پس از جراحی", C: "دیابت", D: "کم‌خونی" },
          correctAnswer: "B",
          explanation: "بی‌حرکتی و حالت هایپرکوآگولابل.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("neurology").id,
      title: "ضعف نیمه بدن و آفازی",
      patientInfo: JSON.stringify({ age: 71, gender: "M", chiefComplaint: "شروع ناگهانی" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/ct_stroke.png",
      mediaType: "IMAGE",
      symptoms: ["همی‌پارزی راست", "آفازی بیانی", "انحراف نگاه"],
      diagnosis: "AIS (Stroke)",
      differentialDiagnosis: ["TIA", "هیپوگلایسمی", "صرع"],
      managementPoints: ["کد استروک", "CT بدون کنتراست", "tPA اگر واجد شرایط"],
      keyNotes: "زمان طلایی 4.5 ساعت",
      questions: [
        {
          questionText: "اولین تصویربرداری ضروری؟",
          options: { A: "MRI", B: "CT بدون کنتراست", C: "CTA", D: "XR قفسه سینه" },
          correctAnswer: "B",
          explanation: "排除 خونریزی.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("gastroenterology").id,
      title: "درد RUQ با تب و زردی",
      patientInfo: JSON.stringify({ age: 36, gender: "F", chiefComplaint: "درد RUQ" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/gb_ultrasound.png",
      mediaType: "IMAGE",
      symptoms: ["تب", "زردی", "درد RUQ"],
      diagnosis: "Cholangitis (Triad Charcot)",
      differentialDiagnosis: ["کوله‌سیستیت", "هپاتیت", "پانکراتیت"],
      managementPoints: ["آنتی‌بیوتیک وسیع‌الطیف", "DRainage ERCP"],
      keyNotes: "تیتر بالینی کلاسیک",
      questions: [
        {
          questionText: "درمان قطعی چیست؟",
          options: { A: "ERCP", B: "آنتی‌بیوتیک تنها", C: "جراحی باز فوری", D: "مشاهده" },
          correctAnswer: "A",
          explanation: "رفع انسداد صفراوی.",
          points: 2,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("trauma").id,
      title: "تصادف موتور، فشار خون پایین",
      patientInfo: JSON.stringify({ age: 28, gender: "M", chiefComplaint: "شوک" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/fast_exam.png",
      mediaType: "IMAGE",
      symptoms: ["تاکی‌کاردی", "BP 80/50", "شکم سفت"],
      diagnosis: "Internal Bleeding",
      differentialDiagnosis: ["پنوموتوراکس کشنده", "تامپوناد قلبی"],
      managementPoints: ["FAST", "ترانسفیوژن Massive", "جراحی اورژانس"],
      keyNotes: "ABCDE",
      questions: [
        {
          questionText: "اولویت تشخیصی؟",
          options: { A: "CT کامل بدن", B: "FAST", C: "MRI", D: "XR لگن" },
          correctAnswer: "B",
          explanation: "ارزیابی سریع خونریزی.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("toxicology").id,
      title: "مصرف بیش‌ازحد پاراسيتامول",
      patientInfo: JSON.stringify({ age: 19, gender: "F", chiefComplaint: "تهوع، درد RUQ" }),
      mediaUrl: null,
      mediaType: null,
      symptoms: ["تهوع", "استفراغ", "درد RUQ"],
      diagnosis: "Acetaminophen Overdose",
      differentialDiagnosis: ["هپاتیت ویروسی", "کوله‌سیستیت"],
      managementPoints: ["NAC", "سطح APAP", "نمودار Rumack-Matthew"],
      keyNotes: "NAC ظرف 8-10 ساعت",
      questions: [
        {
          questionText: "درمان انتخابی؟",
          options: { A: "NAC", B: "آنتی‌بیوتیک", C: "استروئید", D: "لاواژ معده" },
          correctAnswer: "A",
          explanation: "پادزهر اختصاصی.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("infectious").id,
      title: "تب بالا، راش پتشیال",
      patientInfo: JSON.stringify({ age: 24, gender: "M", chiefComplaint: "تب، سردرد" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/meningitis.png",
      mediaType: "IMAGE",
      symptoms: ["سفتی گردن", "فوتوفوبیا", "پتشی"],
      diagnosis: "Meningococcemia",
      differentialDiagnosis: ["مننژیت ویروسی", "سپسیس ناشناخته"],
      managementPoints: ["آنتی‌بیوتیک فوری", "LP بعد از CT در صورت نیاز"],
      keyNotes: "آنتی‌بیوتیک را تأخیر نکنید",
      questions: [
        {
          questionText: "اولین اقدام؟",
          options: { A: "LP فوری", B: "CT و سپس LP", C: "آنتی‌بیوتیک فوری", D: "مشاهده" },
          correctAnswer: "C",
          explanation: "سپسیس نیاز به درمان فوری.",
          points: 2,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("obstetrics").id,
      title: "خونریزی سه‌ماهه سوم",
      patientInfo: JSON.stringify({ age: 32, gender: "F", chiefComplaint: "خونریزی واژینال" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/placenta_previa.png",
      mediaType: "IMAGE",
      symptoms: ["بدون درد", "خونریزی روشن"],
      diagnosis: "Placenta Previa",
      differentialDiagnosis: ["Placental Abruption", "Cervical bleeding"],
      managementPoints: ["سونوگرافی", "اجتناب از معاینه واژینال", "برنامه زایمان"],
      keyNotes: "خونریزی بدون درد",
      questions: [
        {
          questionText: "کدام اقدام ممنوع است؟",
          options: { A: "معاینه واژینال", B: "سونوگرافی", C: "CBC", D: "NST" },
          correctAnswer: "A",
          explanation: "خطر خونریزی شدید.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("pediatrics").id,
      title: "کودک با خس‌خس و تنگی نفس",
      patientInfo: JSON.stringify({ age: 3, gender: "M", chiefComplaint: "سرفه و خس‌خس" }),
      mediaUrl: null,
      mediaType: null,
      symptoms: ["سرفه", "خس‌خس", "تاکی‌پنه"],
      diagnosis: "Asthma Exacerbation",
      differentialDiagnosis: ["Bronchiolitis", "Foreign body"],
      managementPoints: ["SABA نبولایزر", "استروئید خوراکی", "اکسیژن"],
      keyNotes: "ارزیابی شدت",
      questions: [
        {
          questionText: "اولین درمان؟",
          options: { A: "آنتی‌بیوتیک", B: "SABA نبولایزر", C: "آنتی‌هیستامین", D: "استروئید IV" },
          correctAnswer: "B",
          explanation: "برونکودیلاتور سریع.",
          points: 1,
          orderIndex: 1,
        },
      ],
    },
    {
      categoryId: getCat("nephrology").id,
      title: "هایپرکالمی با موج T بلند",
      patientInfo: JSON.stringify({ age: 64, gender: "M", chiefComplaint: "ضعف و تهوع" }),
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/v1700000000/hyperkalemia_ekg.png",
      mediaType: "IMAGE",
      symptoms: ["ضعف", "آریتمی", "تهوع"],
      diagnosis: "Hyperkalemia",
      differentialDiagnosis: ["هیپوکالمی", "MI"],
      managementPoints: ["کلسیم گلوکونات", "انسولین+گلوکز", "فوروزماید/دیالیز"],
      keyNotes: "T بلند و قله‌ای",
      questions: [
        {
          questionText: "حفاظت قلبی فوری؟",
          options: { A: "فوروزماید", B: "کلسیم گلوکونات", C: "انسولین", D: "بیکربنات" },
          correctAnswer: "B",
          explanation: "پایدارسازی غشاء.",
          points: 2,
          orderIndex: 1,
        },
      ],
    },
  ];

  const instructor = await prisma.user.upsert({
    where: { studentCode: "INST001" },
    update: {},
    create: { name: "استاد نمونه", role: "INSTRUCTOR", studentCode: "INST001" },
  });

  const demoStudent = await prisma.user.upsert({
    where: { studentCode: "DUMMY001" },
    update: {},
    create: { name: "دانشجو نمونه", role: "STUDENT", studentCode: "DUMMY001" },
  });

  // Create cases and questions
  for (const c of casesData) {
    const caseFields = toCaseFields(c);
    const created = await prisma.case.create({
      data: {
        categoryId: c.categoryId,
        instructorId: instructor.id,
        title: c.title,
        chiefComplaint: caseFields.chiefComplaint,
        patientInfo: c.patientInfo,
        mediaUrl: c.mediaUrl ?? null,
        mediaType: c.mediaType ? (c.mediaType as "IMAGE" | "VIDEO" | "AUDIO") : null,
        symptoms: c.symptoms,
        diagnosis: c.diagnosis,
        differentialDiagnosis: c.differentialDiagnosis,
        management: caseFields.management,
        teachingPoints: caseFields.teachingPoints,
        status: "PUBLISHED",
        questions: {
          create: c.questions.map(toQuestionCreateData),
        },
      },
    });

    await prisma.userProgress.upsert({
      where: { userId_caseId: { userId: demoStudent.id, caseId: created.id } },
      update: { lastStep: 1, status: "IN_PROGRESS" },
      create: { userId: demoStudent.id, caseId: created.id, lastStep: 1, status: "IN_PROGRESS" },
    });
  }

  console.log("Seed completed with", casesData.length, "cases.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
