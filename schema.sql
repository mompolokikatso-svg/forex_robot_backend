CREATE TABLE IF NOT EXISTS candles (
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL DEFAULT 0,
  PRIMARY KEY (pair, timeframe, time)
);

CREATE INDEX IF NOT EXISTS idx_candles_pair_tf_time
  ON candles (pair, timeframe, time);
