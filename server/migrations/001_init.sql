CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  time_limit_sec int NOT NULL DEFAULT 30 CHECK (time_limit_sec BETWEEN 5 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position int NOT NULL,
  text text NOT NULL,
  options text[] NOT NULL CHECK (cardinality(options) BETWEEN 2 AND 4),
  correct_index int NOT NULL CHECK (correct_index >= 0),
  time_limit_sec int NULL CHECK (time_limit_sec BETWEEN 5 AND 300)
);
CREATE INDEX questions_quiz ON questions(quiz_id, position);

CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NULL REFERENCES quizzes(id) ON DELETE SET NULL,
  quiz_title text NOT NULL,
  code char(6) NOT NULL,
  questions jsonb NOT NULL,
  default_time_sec int NOT NULL,
  status text NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby','question_open','question_closed','revealing','finished','cancelled')),
  step int NOT NULL DEFAULT 0,
  current_index int NULL,
  question_ends_at timestamptz NULL,
  reveal_step int NULL,
  team_count_at_reveal int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);
CREATE UNIQUE INDEX games_active_code ON games(code) WHERE status NOT IN ('finished','cancelled');

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_key text NOT NULL,
  token text NOT NULL UNIQUE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz NULL
);
CREATE UNIQUE INDEX teams_game_name ON teams(game_id, name_key) WHERE removed_at IS NULL;

CREATE TABLE answers (
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  question_index int NOT NULL,
  choice int NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, question_index)
);
CREATE INDEX answers_game ON answers(game_id);
