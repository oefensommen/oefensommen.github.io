/* Supabase connection.
   These two values are PUBLIC by design (the anon key is meant to ship in the
   browser). All real protection lives in the database: the progress table has
   RLS on with no policies, so the anon key cannot touch it directly — the only
   way in is through the load_progress/save_progress functions, which verify the
   password server-side against a bcrypt hash.

   Empty values make the app run fully offline on localStorage (local dev). */
const SUPABASE_URL = "https://ffvqqjyfmwkqljwhrhtl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdnFxanlmbXdrcWxqd2hyaHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1OTAxOTMsImV4cCI6MjEwMTE2NjE5M30.WYYdwlTLKSIveOjIRuR-1fDXEDRI7cO2OwTPQ1cnCa4";
