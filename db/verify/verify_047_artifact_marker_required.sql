-- verify 047 — the documented artifact forms are still stripped, and the
-- content shapes that previously false-matched are left byte-for-byte intact.

with cases(label, input, expected) as (
  values
    -- still stripped (the documented artifact forms)
    ('bracketed case+hash', 'What is the value (case #5_0)?',        'What is the value?'),
    ('bracketed case',      'What is the value [case 5_0]?',          'What is the value?'),
    ('bracketed hash',      'What is the value (#5_0)?',              'What is the value?'),
    ('bracketed case #2',   'A field B(y) (case #2). Terminal speed?','A field B(y). Terminal speed?'),
    ('unbracketed case',    'Conservation laws case #14_2?',          'Conservation laws?'),
    ('unbracketed hash',    'Infinite radius of curvature #16_2?',    'Infinite radius of curvature?'),
    -- preserved (content, not artifacts — the 047 fix)
    ('publication year',    'Five Kingdom Classification (1969), which criterion?',
                            'Five Kingdom Classification (1969), which criterion?'),
    ('two years',           'Schleiden (1838) and Schwann (1839) proposed cell theory.',
                            'Schleiden (1838) and Schwann (1839) proposed cell theory.'),
    ('sqrt notation',       't1 = t / sqrt(2) and t2 = t (1 - 1/sqrt(2))',
                            't1 = t / sqrt(2) and t2 = t (1 - 1/sqrt(2))'),
    ('inverse sine',        'Upstream at angle sin^-1(0.6) with the normal',
                            'Upstream at angle sin^-1(0.6) with the normal'),
    ('bracketed bare int',  'The speed is v (3) m/s',                 'The speed is v (3) m/s')
)
select label,
       input,
       expected,
       content.fn_strip_question_artifacts(input) as actual,
       content.fn_strip_question_artifacts(input) = expected as ok
from cases
order by label;

-- Hard gate: every case above must pass.
do $$
declare
  v_fail int;
begin
  with cases(input, expected) as (
    values
      ('What is the value (case #5_0)?',        'What is the value?'),
      ('What is the value [case 5_0]?',          'What is the value?'),
      ('What is the value (#5_0)?',              'What is the value?'),
      ('A field B(y) (case #2). Terminal speed?','A field B(y). Terminal speed?'),
      ('Conservation laws case #14_2?',          'Conservation laws?'),
      ('Infinite radius of curvature #16_2?',    'Infinite radius of curvature?'),
      ('Five Kingdom Classification (1969), which criterion?',
       'Five Kingdom Classification (1969), which criterion?'),
      ('Schleiden (1838) and Schwann (1839) proposed cell theory.',
       'Schleiden (1838) and Schwann (1839) proposed cell theory.'),
      ('t1 = t / sqrt(2) and t2 = t (1 - 1/sqrt(2))',
       't1 = t / sqrt(2) and t2 = t (1 - 1/sqrt(2))'),
      ('Upstream at angle sin^-1(0.6) with the normal',
       'Upstream at angle sin^-1(0.6) with the normal'),
      ('The speed is v (3) m/s', 'The speed is v (3) m/s')
  )
  select count(*) into v_fail
  from cases
  where content.fn_strip_question_artifacts(input) is distinct from expected;

  if v_fail > 0 then
    raise exception 'verify 047: % artifact-strip case(s) failed', v_fail;
  end if;
end $$;
