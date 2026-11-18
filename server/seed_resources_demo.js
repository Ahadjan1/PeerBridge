const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/db.config');
const { getMoodSubjectId } = require('./src/modules/mood/moodIdentity');

async function seedResourcesDemo() {
  console.log('🌱 Starting Resource Library Demo Seeder (Module 3)...');
  const connection = await pool.getConnection();

  try {
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 1. Prepare sample download file in uploads/resources
    const uploadsDir = path.resolve(__dirname, 'uploads/resources');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const sampleFilePath = path.join(uploadsDir, 'db_normalization_practice.pdf');
    const dummyPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n182\n%%EOF';
    fs.writeFileSync(sampleFilePath, dummyPdf);
    console.log('✓ Prepared sample download file in uploads/resources');

    // 2. Setup Student Account: Kashif (user_id = 4)
    console.log('✓ Configuring Kashif student profile & credentials...');
    await connection.execute(`
      UPDATE users 
      SET password_hash = ?, is_locked = 0, failed_attempts = 0, role = 'student' 
      WHERE id = 4
    `, [hashedPassword]);

    await connection.execute(`
      UPDATE profiles 
      SET name = 'Kashif', 
          anonymous_id = 'BraveOwl#4104',
          department = 'Computer Science', 
          semester = 4, 
          subjects = JSON_ARRAY('Database Systems', 'Data Structures', 'Operating Systems'),
          consent_mood_tracking = 1,
          consent_mood_data = 1,
          consent_analytics = 1,
          onboarding_complete = 1
      WHERE user_id = 4
    `);

    // 3. Setup Faculty Account: Dr. Usman Raza (faculty@szabist.edu / dr.usman@szabist.edu)
    console.log('✓ Setting up Faculty accounts (dr.usman@szabist.edu & faculty@szabist.edu)...');
    // Ensure faculty exists
    await connection.execute(`
      INSERT INTO users (id, email, password_hash, role, is_locked, failed_attempts)
      VALUES (201, 'faculty@szabist.edu', ?, 'faculty', 0, 0)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'faculty', is_locked = 0
    `, [hashedPassword]);

    await connection.execute(`
      INSERT INTO profiles (user_id, anonymous_id, name, department, designation, subjects, onboarding_complete)
      VALUES (201, 'FACULTY_CS_01', 'Dr. Usman Raza', 'Computer Science', 'Assistant Professor', JSON_ARRAY('Database Systems', 'Operating Systems'), 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    // Also support dr.usman@szabist.edu
    await connection.execute(`
      INSERT INTO users (id, email, password_hash, role, is_locked, failed_attempts)
      VALUES (202, 'dr.usman@szabist.edu', ?, 'faculty', 0, 0)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'faculty', is_locked = 0
    `, [hashedPassword]);

    await connection.execute(`
      INSERT INTO profiles (user_id, anonymous_id, name, department, designation, subjects, onboarding_complete)
      VALUES (202, 'FACULTY_CS_02', 'Dr. Usman Raza', 'Computer Science', 'Assistant Professor', JSON_ARRAY('Database Systems', 'Operating Systems'), 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    // 4. Insert recent mood check-in for Kashif (Score: 2 = Stressed)
    // This triggers the Mood-based Wellbeing recommendation bonus (+35) in "For You"
    console.log('✓ Setting Kashif recent mood check-in (score: 2) for dynamic AI recommendations...');
    const kashifSubjectId = getMoodSubjectId(4);
    await connection.execute(`
      INSERT INTO mood_entries 
        (mood_subject_id, department, mood_score, notes, consecutive_low_count, created_at)
      VALUES (?, 'Computer Science', 2, 'Stressed about upcoming Database Systems midterms and lab assignments', 1, NOW())
    `, [kashifSubjectId]);

    // 5. Seed Academic Requests for Database Systems (demand indicator)
    console.log('✓ Seeding Academic Requests to show request demand count...');
    await connection.execute(`DELETE FROM academic_requests WHERE subject = 'Database Systems'`);
    await connection.execute(`
      INSERT INTO academic_requests 
        (user_id, anonymous_id, subject, urgency, title, description, status, ai_moderation_status, created_at)
      VALUES 
        (1, 'PeerLearner#101', 'Database Systems', 'medium', 'Need help understanding BCNF decompositions', 'Looking for peer tutor to explain 3NF vs BCNF examples.', 'open', 'clean', NOW()),
        (2, 'PeerLearner#102', 'Database Systems', 'high', 'SQL Indexing & Query Plans help', 'Struggling with multi-column B+ tree indexing.', 'open', 'clean', NOW()),
        (6, 'PeerLearner#106', 'Database Systems', 'medium', 'Transaction Isolation Levels practice', 'Need someone to review ACID and serializability questions.', 'open', 'clean', NOW())
    `);

    // 6. Clean existing resources tables for pristine demo state
    console.log('✓ Refreshing resources, bookmarks, and reviews...');
    await connection.execute('DELETE FROM resource_reviews');
    await connection.execute('DELETE FROM resource_bookmarks');
    await connection.execute('DELETE FROM resources');

    // 7. Insert Approved & Pending Resources
    console.log('✓ Inserting curated resources for Kashif demo...');
    const resourcesData = [
      // 1. Database Systems Practice (Matches search: "Database", Category: "Practice", Semester: 4)
      {
        uploader_id: 1,
        title: 'Database Systems: Complete BCNF & 3NF Normalization Practice Problems',
        description: 'Comprehensive collection of 25+ solved database normalization problems covering Functional Dependencies, 2NF, 3NF, BCNF decomposition, and lossless join verification with step-by-step proofs.',
        subject: 'Database Systems',
        semester: '4',
        category: 'Practice',
        external_url: 'https://github.com/szabist-cs/database-systems-practice',
        file_path: sampleFilePath,
        original_file_name: 'db_normalization_practice.pdf',
        mime_type: 'application/pdf',
        file_size: 1048576,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 5,
        quality_score: 5,
      },
      // 2. Database Systems Lecture Notes (Matches search: "Database", Category: "Lecture Notes", Semester: 4)
      {
        uploader_id: 6,
        title: 'Relational Database Management: SQL Query Optimization & Indexing Guide',
        description: 'In-depth lecture notes on B+ Tree indexing, query execution plans, hash joins, and ACID transaction isolation levels with MySQL 8.0 examples and benchmarks.',
        subject: 'Database Systems',
        semester: '4',
        category: 'Lecture Notes',
        external_url: 'https://dev.mysql.com/doc/refman/8.0/en/optimization.html',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 5,
        quality_score: 5,
      },
      // 3. Wellbeing Toolkit (Matches Category: "Wellbeing", Semester: 4, Recommended for low mood)
      {
        uploader_id: 7,
        title: 'Student Mental Health & Exam Anxiety Relief Toolkit',
        description: 'Practical mindfulness exercises, pomodoro schedules, sleep hygiene protocols, and cognitive reframing techniques designed specifically for engineering students dealing with midterm stress.',
        subject: 'General',
        semester: '4',
        category: 'Wellbeing',
        external_url: 'https://peerbridge.edu.pk/wellness/exam-toolkit',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 4,
        quality_score: 5,
      },
      // 4. Data Structures Visual Handout (Matches enrolled subject, Semester: 4)
      {
        uploader_id: 1,
        title: 'Data Structures & Algorithms: Trees & Graph Traversal Visual Handout',
        description: 'Color-coded visual cheat sheets explaining AVL Tree balancing rotations, Dijkstra shortest path algorithm, and Minimum Spanning Trees (Kruskal vs Prim).',
        subject: 'Data Structures',
        semester: '4',
        category: 'Lecture Notes',
        external_url: 'https://visualgo.net/en',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 5,
        quality_score: 5,
      },
      // 5. Operating Systems Concurrency Practice (Practice, Semester: 4)
      {
        uploader_id: 8,
        title: 'Operating Systems: Concurrency, Semaphores & Deadlock Detection',
        description: 'Solved lab exercises on POSIX threads, mutex locks, producer-consumer synchronization problems, and Banker algorithm step-by-step simulations.',
        subject: 'Operating Systems',
        semester: '4',
        category: 'Practice',
        external_url: 'https://github.com/remzi-arpacidusseau/ostep-code',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 4,
        quality_score: 4,
      },
      // 6. Campus Wellbeing & Peer Listening (Wellbeing, Semester: 4)
      {
        uploader_id: 2,
        title: 'Campus Wellbeing & Peer Listening Support Guide',
        description: 'Confidential resources for peer counselling, academic burnout management, and daily grounding exercises during high-stress exam weeks.',
        subject: 'General',
        semester: '4',
        category: 'Wellbeing',
        external_url: 'https://peerbridge.edu.pk/support/peer-listening',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 4,
        quality_score: 4,
      },
      // 7. Computer Networks Notes (Semester: 6)
      {
        uploader_id: 5,
        title: 'Computer Networks: TCP/IP Protocol Stack & Wireshark Lab Notes',
        description: 'Packet analysis notes covering 3-way handshake, TCP flow control, sliding window protocol, and DNS resolution packet captures.',
        subject: 'Computer Networks',
        semester: '6',
        category: 'Lecture Notes',
        external_url: 'https://www.wireshark.org/docs/',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'approved',
        is_flagged: 0,
        relevance_score: 4,
        quality_score: 4,
      },
      // 8. PENDING FACULTY REVIEW: Student submission awaiting approval
      {
        uploader_id: 1,
        title: 'Advanced Operating Systems: Virtual Memory & Page Replacement Algorithms',
        description: 'Student submitted notes covering FIFO, LRU, and Optimal page replacement algorithms with page fault calculation charts. Awaiting faculty verification.',
        subject: 'Operating Systems',
        semester: '4',
        category: 'Lecture Notes',
        external_url: 'https://peerbridge.edu.pk/uploads/os_vm_notes.pdf',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'pending',
        is_flagged: 0,
        relevance_score: null,
        quality_score: null,
      },
      // 9. FLAGGED RESOURCE: Low rating automated return to faculty queue
      {
        uploader_id: 2,
        title: 'Calculus I & Linear Algebra Old Past Papers (2018 Edition)',
        description: 'Older question paper archive uploaded by student. Several syllabus topics are outdated according to recent curriculum updates.',
        subject: 'Mathematics',
        semester: '2',
        category: 'Reference',
        external_url: 'https://peerbridge.edu.pk/uploads/calc_past_papers.pdf',
        file_path: null,
        original_file_name: null,
        mime_type: null,
        file_size: null,
        status: 'flagged',
        is_flagged: 1,
        moderation_reason: 'Average rating below 1.5; returned to faculty review queue',
        relevance_score: null,
        quality_score: null,
      }
    ];

    const insertedIds = [];
    for (const r of resourcesData) {
      const [res] = await connection.execute(`
        INSERT INTO resources 
          (uploader_id, title, description, subject, semester, category, external_url,
           file_path, original_file_name, mime_type, file_size, status, is_flagged,
           moderation_reason, relevance_score, quality_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        r.uploader_id,
        r.title,
        r.description,
        r.subject,
        r.semester,
        r.category,
        r.external_url,
        r.file_path,
        r.original_file_name,
        r.mime_type,
        r.file_size,
        r.status,
        r.is_flagged,
        r.moderation_reason || null,
        r.relevance_score,
        r.quality_score
      ]);
      insertedIds.push(res.insertId);
    }
    console.log(`✓ Inserted ${insertedIds.length} resources (7 approved, 1 pending, 1 flagged)`);

    // 8. Seed Realistic Star Ratings & Reviews for Approved Cards
    console.log('✓ Seeding ratings & peer reviews...');
    const reviewsData = [
      // Reviews for Resource 1 (Database Practice)
      { resource_id: insertedIds[0], user_id: 2, rating: 5, review: 'Brilliant collection of normalization problems. Helped me ace my 3NF vs BCNF quiz!' },
      { resource_id: insertedIds[0], user_id: 6, rating: 5, review: 'Lossless join decomposition is explained so clearly with proofs.' },
      { resource_id: insertedIds[0], user_id: 7, rating: 4, review: 'Very useful practice questions before midterms.' },

      // Reviews for Resource 2 (Database Notes)
      { resource_id: insertedIds[1], user_id: 1, rating: 5, review: 'The query optimization plans and indexing benchmarks are top notch.' },
      { resource_id: insertedIds[1], user_id: 8, rating: 5, review: 'Explains B+ Trees and transaction isolation levels clearly.' },

      // Reviews for Resource 3 (Mental Health Toolkit)
      { resource_id: insertedIds[2], user_id: 1, rating: 5, review: 'Honestly needed this during midterm week. The Pomodoro and breathing exercises helped a lot.' },
      { resource_id: insertedIds[2], user_id: 2, rating: 5, review: 'Great practical tips for stress management!' },

      // Reviews for Resource 4 (Data Structures Visual Handout)
      { resource_id: insertedIds[3], user_id: 6, rating: 5, review: 'AVL tree rotations diagrams are crystal clear.' },

      // Reviews for Resource 5 (OS Concurrency Practice)
      { resource_id: insertedIds[4], user_id: 1, rating: 4, review: 'Good producer-consumer problem implementations in C.' },

      // Reviews for Resource 6 (Campus Wellbeing)
      { resource_id: insertedIds[5], user_id: 7, rating: 5, review: 'Wonderful peer support initiative on campus.' },
    ];

    for (const rev of reviewsData) {
      await connection.execute(`
        INSERT INTO resource_reviews (resource_id, user_id, rating, review, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [rev.resource_id, rev.user_id, rev.rating, rev.review]);
    }
    console.log(`✓ Inserted ${reviewsData.length} ratings and reviews`);

    console.log('\n======================================================');
    console.log('🎉 Resource Library Dummy Data Seeded Successfully!');
    console.log('======================================================');
    console.log('STUDENT ACCOUNT (Kashif):');
    console.log('  Email:    kashif@szabist.edu');
    console.log('  Password: Password123!');
    console.log('  Role:     student (Semester 4, CS)');
    console.log('  Subjects: Database Systems, Data Structures, Operating Systems');
    console.log('  Mood:     Score 2 (triggers +35 Wellbeing recommendation)');
    console.log('------------------------------------------------------');
    console.log('FACULTY ACCOUNT (For Step 5 Approval Workflow):');
    console.log('  Email:    faculty@szabist.edu  (or dr.usman@szabist.edu)');
    console.log('  Password: Password123!');
    console.log('  Role:     faculty');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed seeding resource demo:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

seedResourcesDemo();
