-- India seed (docs/12 §10 phase 2, §11): the country, its 36 states and union territories, and the
-- launch cities. Only Bengaluru is `is_launched` — that flag means "we curate here", never "search
-- works here" (docs/12 §2.1). Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running
-- (or adding rows later) never duplicates or overwrites an edit made in the admin.
--
-- State `center` is left null on purpose: nothing reads it yet and a guessed centroid is worse than
-- none. City centers are the city-centre point, used for nearest-city resolution.
INSERT INTO "countries" ("iso2", "iso3", "name", "slug", "phone_code", "currency", "center", "is_launched")
VALUES ('IN', 'IND', 'India', 'india', '+91', 'INR', ST_SetSRID(ST_MakePoint(78.6569, 22.9734), 4326)::geography, false)
ON CONFLICT ("iso2") DO NOTHING;
--> statement-breakpoint
INSERT INTO "states" ("country_id", "code", "name", "slug", "kind")
SELECT c."id", v."code", v."name", v."slug", v."kind"
FROM (VALUES
  ('AP', 'Andhra Pradesh', 'andhra-pradesh', 'state'),
  ('AR', 'Arunachal Pradesh', 'arunachal-pradesh', 'state'),
  ('AS', 'Assam', 'assam', 'state'),
  ('BR', 'Bihar', 'bihar', 'state'),
  ('CG', 'Chhattisgarh', 'chhattisgarh', 'state'),
  ('GA', 'Goa', 'goa', 'state'),
  ('GJ', 'Gujarat', 'gujarat', 'state'),
  ('HR', 'Haryana', 'haryana', 'state'),
  ('HP', 'Himachal Pradesh', 'himachal-pradesh', 'state'),
  ('JH', 'Jharkhand', 'jharkhand', 'state'),
  ('KA', 'Karnataka', 'karnataka', 'state'),
  ('KL', 'Kerala', 'kerala', 'state'),
  ('MP', 'Madhya Pradesh', 'madhya-pradesh', 'state'),
  ('MH', 'Maharashtra', 'maharashtra', 'state'),
  ('MN', 'Manipur', 'manipur', 'state'),
  ('ML', 'Meghalaya', 'meghalaya', 'state'),
  ('MZ', 'Mizoram', 'mizoram', 'state'),
  ('NL', 'Nagaland', 'nagaland', 'state'),
  ('OD', 'Odisha', 'odisha', 'state'),
  ('PB', 'Punjab', 'punjab', 'state'),
  ('RJ', 'Rajasthan', 'rajasthan', 'state'),
  ('SK', 'Sikkim', 'sikkim', 'state'),
  ('TN', 'Tamil Nadu', 'tamil-nadu', 'state'),
  ('TG', 'Telangana', 'telangana', 'state'),
  ('TR', 'Tripura', 'tripura', 'state'),
  ('UP', 'Uttar Pradesh', 'uttar-pradesh', 'state'),
  ('UK', 'Uttarakhand', 'uttarakhand', 'state'),
  ('WB', 'West Bengal', 'west-bengal', 'state'),
  ('AN', 'Andaman and Nicobar Islands', 'andaman-and-nicobar-islands', 'union_territory'),
  ('CH', 'Chandigarh', 'chandigarh', 'union_territory'),
  ('DH', 'Dadra and Nagar Haveli and Daman and Diu', 'dadra-and-nagar-haveli-and-daman-and-diu', 'union_territory'),
  ('DL', 'Delhi', 'delhi', 'union_territory'),
  ('JK', 'Jammu and Kashmir', 'jammu-and-kashmir', 'union_territory'),
  ('LA', 'Ladakh', 'ladakh', 'union_territory'),
  ('LD', 'Lakshadweep', 'lakshadweep', 'union_territory'),
  ('PY', 'Puducherry', 'puducherry', 'union_territory')
) AS v ("code", "name", "slug", "kind")
CROSS JOIN "countries" c
WHERE c."iso2" = 'IN'
ON CONFLICT ("country_id", "slug") DO NOTHING;
--> statement-breakpoint
-- The state is looked up by slug within India, so the composite FK (state_id, country_id) is
-- satisfied by construction.
INSERT INTO "cities" ("country_id", "state_id", "name", "slug", "center", "timezone", "is_launched")
SELECT c."id", s."id", v."name", v."slug",
       ST_SetSRID(ST_MakePoint(v."lng", v."lat"), 4326)::geography,
       'Asia/Kolkata', v."is_launched"
FROM (VALUES
  ('Bengaluru', 'bengaluru', 'karnataka', 12.9716, 77.5946, true),
  ('Mysuru', 'mysuru', 'karnataka', 12.2958, 76.6394, false),
  ('Mangaluru', 'mangaluru', 'karnataka', 12.9141, 74.8560, false),
  ('Mumbai', 'mumbai', 'maharashtra', 19.0760, 72.8777, false),
  ('Pune', 'pune', 'maharashtra', 18.5204, 73.8567, false),
  ('Nagpur', 'nagpur', 'maharashtra', 21.1458, 79.0882, false),
  ('Delhi', 'delhi', 'delhi', 28.6139, 77.2090, false),
  ('Gurugram', 'gurugram', 'haryana', 28.4595, 77.0266, false),
  ('Noida', 'noida', 'uttar-pradesh', 28.5355, 77.3910, false),
  ('Lucknow', 'lucknow', 'uttar-pradesh', 26.8467, 80.9462, false),
  ('Hyderabad', 'hyderabad', 'telangana', 17.3850, 78.4867, false),
  ('Chennai', 'chennai', 'tamil-nadu', 13.0827, 80.2707, false),
  ('Coimbatore', 'coimbatore', 'tamil-nadu', 11.0168, 76.9558, false),
  ('Kochi', 'kochi', 'kerala', 9.9312, 76.2673, false),
  ('Thiruvananthapuram', 'thiruvananthapuram', 'kerala', 8.5241, 76.9366, false),
  ('Kolkata', 'kolkata', 'west-bengal', 22.5726, 88.3639, false),
  ('Ahmedabad', 'ahmedabad', 'gujarat', 23.0225, 72.5714, false),
  ('Surat', 'surat', 'gujarat', 21.1702, 72.8311, false),
  ('Jaipur', 'jaipur', 'rajasthan', 26.9124, 75.7873, false),
  ('Chandigarh', 'chandigarh', 'chandigarh', 30.7333, 76.7794, false),
  ('Indore', 'indore', 'madhya-pradesh', 22.7196, 75.8577, false),
  ('Bhopal', 'bhopal', 'madhya-pradesh', 23.2599, 77.4126, false),
  ('Visakhapatnam', 'visakhapatnam', 'andhra-pradesh', 17.6868, 83.2185, false),
  ('Patna', 'patna', 'bihar', 25.5941, 85.1376, false),
  ('Bhubaneswar', 'bhubaneswar', 'odisha', 20.2961, 85.8245, false),
  ('Guwahati', 'guwahati', 'assam', 26.1445, 91.7362, false),
  ('Panaji', 'panaji', 'goa', 15.4909, 73.8278, false)
) AS v ("name", "slug", "state_slug", "lat", "lng", "is_launched")
JOIN "countries" c ON c."iso2" = 'IN'
JOIN "states" s ON s."country_id" = c."id" AND s."slug" = v."state_slug"
ON CONFLICT ("country_id", "slug") DO NOTHING;
