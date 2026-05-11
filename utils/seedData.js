/**
 * Test data generator - Arabic names
 * Used by POST /api/admin/seed to populate the DB for roulette testing.
 *
 * Names are pulled from a pool large enough to produce ~50,000 unique
 * triple-name combinations.
 */

const FIRST = [
    'محمد', 'أحمد', 'عبدالله', 'عبدالعزيز', 'عبدالرحمن', 'فهد', 'خالد', 'سعد', 'سلطان',
    'تركي', 'بدر', 'ناصر', 'منصور', 'فيصل', 'سامي', 'وليد', 'ماجد', 'بندر', 'مشعل',
    'ياسر', 'هاشم', 'إبراهيم', 'يوسف', 'إسماعيل', 'عمر', 'حسن', 'حسين', 'علي', 'طارق',
    'زياد', 'هشام', 'كريم', 'سيف', 'راكان', 'سعود', 'مازن', 'نواف', 'عثمان', 'صالح',
    'مالك', 'حمد', 'حمود', 'عبدالملك', 'عبداللطيف', 'مهند', 'رائد', 'فارس', 'أنس',
    'ريان', 'مروان', 'أيمن', 'بسام', 'جابر', 'جاسم', 'حازم', 'حاتم', 'رامي', 'رمزي',
    'سعيد', 'شاكر', 'صابر', 'صادق', 'ضياء', 'طلال', 'عادل', 'عامر', 'عاطف', 'عبدالكريم',
    'عصام', 'فادي', 'كمال', 'لؤي', 'مؤيد', 'مجدي', 'محمود', 'مصطفى', 'نادر', 'نبيل',
    // Female
    'سارة', 'فاطمة', 'مريم', 'عائشة', 'نورة', 'هند', 'رنا', 'ريم', 'لمى', 'دانة',
    'منى', 'سلمى', 'ليان', 'جود', 'لينا', 'لطيفة', 'منيرة', 'هيفاء', 'وفاء', 'وجدان',
    'أمل', 'بشرى', 'تهاني', 'ثريا', 'جواهر', 'حصة', 'خديجة', 'دلال', 'رحاب', 'زينب',
    'سمر', 'شيخة', 'صفية', 'ضحى', 'عبير', 'غادة', 'فدوى', 'كوثر', 'لبنى', 'ميساء',
    'نجلاء', 'هدى', 'يسرى', 'أمينة', 'بدرية', 'تغريد', 'حنان', 'دعاء', 'رغد', 'سحر'
];

const FATHER = [
    'محمد', 'أحمد', 'عبدالله', 'عبدالعزيز', 'عبدالرحمن', 'فهد', 'خالد', 'سعد', 'سلطان',
    'تركي', 'بدر', 'ناصر', 'منصور', 'فيصل', 'سامي', 'وليد', 'ماجد', 'بندر', 'مشعل',
    'إبراهيم', 'يوسف', 'عمر', 'حسن', 'حسين', 'علي', 'طارق', 'زياد', 'هشام', 'سيف',
    'راكان', 'سعود', 'مازن', 'نواف', 'عثمان', 'صالح', 'مالك', 'حمد', 'حمود', 'سعيد',
    'حازم', 'رامي', 'عادل', 'مصطفى', 'محمود', 'نبيل', 'جابر', 'فارس', 'أنس', 'ريان'
];

const FAMILY = [
    'العتيبي', 'الحربي', 'الشمري', 'القحطاني', 'الدوسري', 'الزهراني', 'الغامدي', 'المطيري',
    'البقمي', 'العنزي', 'السبيعي', 'العمري', 'الشهري', 'المالكي', 'الرشيدي', 'الفيفي',
    'الجهني', 'المحمدي', 'الصاعدي', 'الخالدي', 'المنصوري', 'الزائدي', 'العسيري', 'القرني',
    'البلوي', 'الحازمي', 'النفيعي', 'العامري', 'العسكر', 'القرشي', 'الهلالي', 'الشمراني',
    'البيشي', 'الحسيني', 'الهاجري', 'العوفي', 'الحسني', 'الراشد', 'الفهد', 'الجابر',
    'السعيد', 'الخليفة', 'العثمان', 'الحمد', 'الغانم', 'المبارك', 'الخميس', 'الفايز',
    'الرويلي', 'العجمي', 'الذيابي', 'السلمي', 'الثبيتي', 'المرواني', 'الخميسي', 'البريكي',
    'الزعابي', 'المنصور', 'النعيم', 'الفريدي'
];

/**
 * Pick a random element from array.
 */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate `count` unique participants in-memory.
 * Returns array of { full_name, email, employee_number }.
 *
 * Uniqueness is guaranteed within the batch by:
 *  - employee_number: TEST-{startNum + i}
 *  - email:           test{startNum + i}@example.com
 *  - full_name:       uses random pick; if collision in batch we re-roll up to 30x,
 *                     and as final fallback append a unique numeric suffix.
 */
function generateParticipants(count, startNum = 1) {
    const out = [];
    const usedNames = new Set();

    for (let i = 0; i < count; i++) {
        const seq = startNum + i;

        // Try to find a unique name combination
        let full_name = '';
        let attempts = 0;
        while (attempts < 30) {
            full_name = `${pick(FIRST)} ${pick(FATHER)} ${pick(FAMILY)}`;
            if (!usedNames.has(full_name)) break;
            attempts++;
        }
        // Fallback: append numeric suffix
        if (usedNames.has(full_name)) {
            full_name = `${full_name} ${seq}`;
        }
        usedNames.add(full_name);

        out.push({
            full_name,
            email: `test${seq}@example.com`,
            employee_number: `TEST-${String(seq).padStart(4, '0')}`
        });
    }

    return out;
}

module.exports = { generateParticipants };
