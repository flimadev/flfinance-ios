// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_overjoyed_silver_fox.sql';
import m0001 from './0001_deep_punisher.sql';
import m0002 from './0002_cards_recurring_safe.sql';
import m0003 from './0003_loving_steel_serpent.sql';
import m0004 from './0004_large_texas_twister.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004
    }
  }
  