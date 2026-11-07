-- =====================================================
-- Seed script for Mixed MCQ + Essay Test
-- Run this in the Supabase SQL Editor
--
-- PREREQUISITE: Run add-ai-evaluation-tables.sql first!
-- =====================================================

-- First, ensure the category exists
INSERT INTO exam_categories (name, description, sort_order)
VALUES ('General Studies', 'GS papers covering history, polity, geography, and more', 1)
ON CONFLICT DO NOTHING;

-- Get the category ID
DO $$
DECLARE
    v_category_id INT;
    v_test_id INT;
    v_history_section_id INT;
    v_geography_section_id INT;
    v_culture_section_id INT;
BEGIN
    -- Get category ID
    SELECT id INTO v_category_id FROM exam_categories WHERE name = 'General Studies' LIMIT 1;

    -- Create the test
    INSERT INTO tests (title, description, category_id, is_premium, duration_minutes, total_marks, passing_marks, test_type)
    VALUES (
        'Sikkim GK Mixed Test - Demo',
        'A demo test with both MCQ and essay questions about Sikkim history and culture. This test demonstrates the AI evaluation feature.',
        v_category_id,
        false,
        30,
        50,
        25,
        'mixed'
    )
    RETURNING id INTO v_test_id;

    RAISE NOTICE 'Created test with ID: %', v_test_id;

    -- Create sections
    INSERT INTO test_sections (test_id, name, sort_order)
    VALUES (v_test_id, 'History', 1)
    RETURNING id INTO v_history_section_id;

    INSERT INTO test_sections (test_id, name, sort_order)
    VALUES (v_test_id, 'Geography', 2)
    RETURNING id INTO v_geography_section_id;

    INSERT INTO test_sections (test_id, name, sort_order)
    VALUES (v_test_id, 'Culture', 3)
    RETURNING id INTO v_culture_section_id;

    RAISE NOTICE 'Created sections: History (%), Geography (%), Culture (%)', v_history_section_id, v_geography_section_id, v_culture_section_id;

    -- MCQ Questions

    -- Q1: History - When did Sikkim become a state
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'In which year did Sikkim become the 22nd state of India?',
        'mcq',
        '[{"id":"a","text":"1971"},{"id":"b","text":"1973"},{"id":"c","text":"1975"},{"id":"d","text":"1977"}]'::jsonb,
        'c',
        2,
        0.5,
        'Sikkim became the 22nd state of India on May 16, 1975 after a referendum in which 97.5% of voters supported abolition of the monarchy.',
        v_history_section_id,
        1
    );

    -- Q2: Geography - Teesta tributary
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'Which river is the main tributary of the Teesta River in Sikkim?',
        'mcq',
        '[{"id":"a","text":"Rangeet"},{"id":"b","text":"Lachung"},{"id":"c","text":"Dikchu"},{"id":"d","text":"Rongni"}]'::jsonb,
        'a',
        2,
        0.5,
        'The Rangeet River is the main tributary of the Teesta River. It originates from the Rathong Glacier and meets the Teesta near Melli.',
        v_geography_section_id,
        2
    );

    -- Q3: Geography - Highest peak
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'What is the highest peak in Sikkim?',
        'mcq',
        '[{"id":"a","text":"Mount Everest"},{"id":"b","text":"Kanchenjunga"},{"id":"c","text":"Pandim"},{"id":"d","text":"Kabru"}]'::jsonb,
        'b',
        2,
        0.5,
        'Kanchenjunga (8,586m) is the highest peak in Sikkim and the third highest mountain in the world. It is considered sacred by the people of Sikkim.',
        v_geography_section_id,
        3
    );

    -- Q4: History - Dynasty
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'Which dynasty ruled Sikkim before it became part of India?',
        'mcq',
        '[{"id":"a","text":"Chogyal Dynasty"},{"id":"b","text":"Namgyal Dynasty"},{"id":"c","text":"Bhutia Dynasty"},{"id":"d","text":"Lepcha Dynasty"}]'::jsonb,
        'b',
        2,
        0.5,
        'The Namgyal Dynasty ruled Sikkim from 1642 until 1975. The rulers were known as Chogyal (meaning ''Righteous King'').',
        v_history_section_id,
        4
    );

    -- Q5: Culture - Lepcha dance
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'What is the traditional dance form of the Lepcha community?',
        'mcq',
        '[{"id":"a","text":"Cham"},{"id":"b","text":"Zho-ma-lu-shao"},{"id":"c","text":"Singhi Chaam"},{"id":"d","text":"Maruni"}]'::jsonb,
        'b',
        2,
        0.5,
        'Zho-ma-lu-shao is a traditional harvest dance of the Lepcha community performed during Tendong Lho Rum Faat festival.',
        v_culture_section_id,
        5
    );

    -- Q6: Culture - Oldest monastery
    INSERT INTO questions (test_id, content, type, options, correct_answer, marks, negative_marks, explanation, section_id, sort_order)
    VALUES (
        v_test_id,
        'Which monastery is the oldest in Sikkim?',
        'mcq',
        '[{"id":"a","text":"Rumtek Monastery"},{"id":"b","text":"Pemayangtse Monastery"},{"id":"c","text":"Enchey Monastery"},{"id":"d","text":"Dubdi Monastery"}]'::jsonb,
        'd',
        2,
        0.5,
        'Dubdi Monastery, also known as ''The Hermit''s Cell'', was built in 1701 and is the oldest monastery in Sikkim.',
        v_culture_section_id,
        6
    );

    -- Essay Question 1: Kanchenjunga significance
    INSERT INTO questions (test_id, content, type, marks, negative_marks, word_limit, model_answer, section_id, sort_order)
    VALUES (
        v_test_id,
        'Discuss the significance of Kanchenjunga in the culture and traditions of Sikkim. How has the mountain influenced the religious beliefs and daily life of the local communities?',
        'conventional',
        15,
        0,
        250,
        'Kanchenjunga holds immense cultural and religious significance for the people of Sikkim. Key points to cover:

1. Religious Significance:
- Considered sacred by both Buddhist and indigenous communities
- Worshipped as a protective deity (Dzonga)
- The annual Pang Lhabsol festival celebrates Kanchenjunga as the guardian deity

2. Cultural Impact:
- Features prominently in local folklore and legends
- Influences art, music, and traditional dances
- The mountain is never climbed by locals out of respect

3. Daily Life:
- Guides agricultural practices through weather patterns
- Tourism and trekking economy centered around the mountain
- Environmental conservation efforts tied to religious reverence

4. Identity:
- Symbol of Sikkimese identity and pride
- State emblem features the mountain
- Unifying element across different ethnic communities',
        v_culture_section_id,
        7
    );

    -- Essay Question 2: Merger with India
    INSERT INTO questions (test_id, content, type, marks, negative_marks, word_limit, model_answer, section_id, sort_order)
    VALUES (
        v_test_id,
        'Analyze the factors that led to the merger of Sikkim with India in 1975. What were the political, social, and economic conditions that influenced this historic decision?',
        'conventional',
        15,
        0,
        300,
        'The merger of Sikkim with India in 1975 was influenced by multiple factors:

1. Political Factors:
- Growing pro-democracy movement against the Chogyal''s monarchy
- India''s concerns about Chinese influence in the region
- Strategic importance of Sikkim for national security
- The 1973 anti-Chogyal agitation and subsequent elections

2. Social Factors:
- Ethnic tensions between Nepali majority and Bhutia-Lepcha minority
- Demands for democratic representation
- Influence of democratic movements in neighboring regions
- Education and exposure leading to political awareness

3. Economic Factors:
- Economic dependence on India for trade and supplies
- Limited resources and development under the monarchy
- Desire for economic integration with India

4. The Referendum:
- April 1975 referendum with 97.5% support for merger
- Constitutional amendment making Sikkim the 22nd state
- Role of Kazi Lhendup Dorji and the Sikkim Congress

5. International Context:
- Cold War dynamics
- China''s claims and border disputes
- Treaty relationships with India since 1950',
        v_history_section_id,
        8
    );

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test created successfully!';
    RAISE NOTICE 'Test ID: %', v_test_id;
    RAISE NOTICE 'Total MCQ Questions: 6';
    RAISE NOTICE 'Total Essay Questions: 2';
    RAISE NOTICE 'Total Marks: 50';
    RAISE NOTICE 'Duration: 30 minutes';
    RAISE NOTICE 'Visit: http://localhost:3000/test/%', v_test_id;
    RAISE NOTICE '========================================';

END $$;
