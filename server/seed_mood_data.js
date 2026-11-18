const crypto = require('crypto');
const { pool } = require('./src/config/db.config');
const { getMoodSubjectId } = require('./src/modules/mood/moodIdentity');

// Helper to generate a unique pseudonymous subject id for mock students
function generateSubjectId(seed) {
  return crypto.createHash('sha256').update(`peerbridge:mock:mood:${seed}`).digest('hex');
}

const DEPARTMENTS = [
  {
    name: 'Computer Science',
    // Realistic curve base averages over 14 days
    // Dips slightly mid-week (exams/assignments) and rises
    dailyBase: [3.8, 3.7, 3.9, 3.5, 3.2, 3.4, 3.8, 4.1, 4.0, 3.6, 3.3, 3.5, 4.0, 4.2],
    studentIds: [
      getMoodSubjectId(1), // user 1 (ahad)
      getMoodSubjectId(6),
      getMoodSubjectId(7),
      getMoodSubjectId(8),
      getMoodSubjectId(9),
      getMoodSubjectId(10),
      generateSubjectId('cs_student_7'),
      generateSubjectId('cs_student_8'),
    ],
    sampleNotes: [
      'Finished my data structures assignment on time!',
      'Feeling a bit stressed about the upcoming midterm.',
      'Great group study session at the library.',
      'Coding lab was tough but learned a lot.',
      'Feeling energized and ready for presentations.',
      'Need to catch up on sleep after submission deadline.',
      'Solid productive day today.'
    ]
  },
  {
    name: 'Software Engineering',
    dailyBase: [4.0, 4.1, 3.9, 3.8, 3.7, 4.0, 4.2, 4.1, 3.9, 3.7, 3.8, 4.0, 4.3, 4.4],
    studentIds: [
      generateSubjectId('se_student_1'),
      generateSubjectId('se_student_2'),
      generateSubjectId('se_student_3'),
      generateSubjectId('se_student_4'),
      generateSubjectId('se_student_5'),
      generateSubjectId('se_student_6'),
      generateSubjectId('se_student_7'),
    ],
    sampleNotes: [
      'Sprint review went smoothly.',
      'Architecture design doc finally approved.',
      'Debugging race conditions took all afternoon.',
      'Good team collaboration today.',
      'Proud of the feature we shipped!',
      'Feeling good about the semester project.',
      'A bit exhausted from agile standups.'
    ]
  },
  {
    name: 'Artificial Intelligence',
    dailyBase: [4.2, 4.3, 4.1, 4.0, 3.8, 4.2, 4.4, 4.3, 4.2, 3.9, 4.1, 4.3, 4.5, 4.6],
    studentIds: [
      generateSubjectId('ai_student_1'),
      generateSubjectId('ai_student_2'),
      generateSubjectId('ai_student_3'),
      generateSubjectId('ai_student_4'),
      generateSubjectId('ai_student_5'),
      generateSubjectId('ai_student_6'),
      generateSubjectId('ai_student_7'),
    ],
    sampleNotes: [
      'Model training completed with 94% accuracy!',
      'Struggling with gradient vanishing issue, will ask professor.',
      'Fascinating lecture on NLP transformer architectures.',
      'Team paper draft is ready for review.',
      'Excited about our capstone project idea.',
      'GPU quota exhausted, waiting for next run.',
      'Really enjoyed today’s robotics lab.'
    ]
  },
  {
    name: 'Business Administration',
    dailyBase: [3.6, 3.7, 3.5, 3.8, 3.9, 4.0, 4.1, 3.7, 3.6, 3.8, 4.0, 4.1, 4.2, 4.3],
    studentIds: [
      generateSubjectId('bba_student_1'),
      generateSubjectId('bba_student_2'),
      generateSubjectId('bba_student_3'),
      generateSubjectId('bba_student_4'),
      generateSubjectId('bba_student_5'),
      generateSubjectId('bba_student_6'),
      generateSubjectId('bba_student_7'),
    ],
    sampleNotes: [
      'Case study presentation went really well.',
      'Marketing strategy debate was lively!',
      'Financial accounting quiz was challenging.',
      'Mentorship session gave me great career clarity.',
      'Group work is finally coming together.',
      'Feeling optimistic about upcoming internship interviews.',
      'Quiet study day.'
    ]
  }
];

async function seedMoodData() {
  console.log('🌱 Starting Mood Tracker dummy data seeding...');
  const connection = await pool.getConnection();

  try {
    // 1. Ensure student consent is active for real users
    console.log('1. Enabling mood tracking consent for student profiles...');
    await connection.execute(`
      UPDATE profiles 
      SET consent_mood_tracking = 1, consent_mood_data = 1, consent_analytics = 1 
      WHERE user_id IN (1, 2, 4, 5, 6, 7, 8, 9, 10, 11)
    `);

    // 2. Clear old mood entries to give a clean, beautiful trend line
    console.log('2. Refreshing mood_entries table...');
    await connection.execute('DELETE FROM mood_entries');

    // 3. Generate 14 days of mood entries up to today
    console.log('3. Generating 14 days of realistic check-ins across 4 departments...');
    const now = new Date();
    const rowsToInsert = [];

    // 14 days: dayIndex 0 (13 days ago) to 13 (today)
    for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
      const daysAgo = 13 - dayIndex;
      const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      for (const dept of DEPARTMENTS) {
        const baseAvg = dept.dailyBase[dayIndex];

        dept.studentIds.forEach((studentId, sIdx) => {
          // Add slight personal variance around the department daily base
          const variance = ((sIdx % 3) - 1) * 0.4; // -0.4, 0, or +0.4
          let score = Math.round(baseAvg + variance);
          if (score < 1) score = 1;
          if (score > 5) score = 5;

          const note = dept.sampleNotes[(dayIndex + sIdx) % dept.sampleNotes.length];
          const consecutiveLow = score <= 2 ? 1 : 0;

          // Realistic submission time between 09:00 and 21:00
          const entryTime = new Date(targetDate);
          entryTime.setHours(9 + (sIdx * 2) % 12, (sIdx * 17) % 60, (sIdx * 23) % 60);

          rowsToInsert.push([
            studentId,
            dept.name,
            score,
            note,
            consecutiveLow,
            entryTime
          ]);
        });
      }
    }

    console.log(`Inserting ${rowsToInsert.length} mood entries...`);
    // Batch insert
    for (const row of rowsToInsert) {
      await connection.execute(
        `INSERT INTO mood_entries 
         (mood_subject_id, department, mood_score, notes, consecutive_low_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row
      );
    }

    console.log('✅ Mood Tracker dummy data seeded successfully!');
    console.log(`Total check-ins created: ${rowsToInsert.length}`);
    console.log(`Departments covered: ${DEPARTMENTS.map(d => d.name).join(', ')}`);
    console.log('Each department has 7-8 distinct participants per day (satisfies privacy threshold >= 5).');
    
    // Quick verification
    const [summary] = await connection.execute(`
      SELECT department, COUNT(*) as entries_count, COUNT(DISTINCT mood_subject_id) as participants,
             ROUND(AVG(mood_score), 2) as overall_avg
      FROM mood_entries
      GROUP BY department
    `);
    console.table(summary);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding mood data:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

seedMoodData();
