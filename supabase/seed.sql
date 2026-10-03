insert into public.restaurants (id, name, cuisine, latitude, longitude, rarity, discovery_xp, reward_cents, estimated_meal_cents, tags, description, image_url, availability, is_synthetic) values
('demo-mission-taco','Mission Comet Tacos','Mexican',37.7599,-122.4148,'common',150,50,1400,array['tacos','spicy','casual'],'Bright street-style tacos with seasonal salsas.',null,'open',true),
('demo-sunset-ramen','Sunset Nebula Ramen','Japanese',37.7635,-122.4662,'rare',400,50,1900,array['ramen','noodles','cozy'],'Slow-simmered broths and handmade noodles in the Sunset.',null,'open',true),
('demo-embarcadero-bites','Embarcadero Orbit Bites','Californian',37.7955,-122.3937,'epic',800,50,2500,array['waterfront','seasonal','seafood'],'A compact waterfront menu built around California produce.',null,'open',true),
('demo-richmond-dumpling','Richmond Meteor Dumplings','Chinese',37.7809,-122.4660,'common',150,50,1600,array['dumplings','shared','casual'],'Hand-folded dumplings served in generous shareable baskets.',null,'open',true),
('demo-noe-pasta','Noe Valley Moon Pasta','Italian',37.7504,-122.4337,'rare',400,50,2300,array['pasta','date-night','vegetarian'],'Fresh pasta and garden vegetables in a neighborhood room.',null,'open',true),
('demo-soma-curry','SoMa Signal Curry','Indian',37.7782,-122.4003,'common',150,50,1700,array['curry','spicy','vegan'],'Fast regional curries with rotating rice and chutney pairings.',null,'open',true),
('demo-marina-mezze','Marina Star Mezze','Mediterranean',37.8013,-122.4380,'rare',400,50,2200,array['mezze','shared','vegetarian'],'Colorful small plates inspired by the eastern Mediterranean.',null,'open',true),
('demo-castro-bakery','Castro Cosmic Bakery','Bakery',37.7609,-122.4350,'common',150,50,1100,array['pastry','coffee','breakfast'],'Original pastries, breakfast buns, and carefully brewed coffee.',null,'open',true),
('demo-chinatown-tea','Chinatown Lunar Tea Room','Tea House',37.7941,-122.4078,'legendary',1200,50,2800,array['tea','dim-sum','quiet'],'A ceremonial tea room with a concise handmade snack menu.',null,'open',true),
('demo-haight-bowls','Haight Aurora Bowls','Californian',37.7694,-122.4481,'common',150,50,1500,array['healthy','vegan','bowls'],'Produce-forward grain bowls with bold house dressings.',null,'open',true),
('demo-potrero-bbq','Potrero Rocket BBQ','Barbecue',37.7561,-122.4011,'epic',800,50,2600,array['barbecue','hearty','shared'],'Wood-smoked plates and bright pickles with skyline views.',null,'open',true),
('demo-northbeach-pizza','North Beach Planet Pizza','Italian',37.8002,-122.4091,'common',150,50,1800,array['pizza','family','casual'],'Thin, blistered pies with classic and seasonal toppings.',null,'open',true),
('demo-dogpatch-korean','Dogpatch Nova Kitchen','Korean',37.7587,-122.3885,'rare',400,50,2100,array['korean','grill','spicy'],'Korean comfort dishes with a compact charcoal-grilled menu.',null,'open',true),
('demo-presidio-picnic','Presidio Pathfinder Picnic','Sandwiches',37.7910,-122.4555,'epic',800,50,1750,array['picnic','sandwiches','outdoors'],'Packable sandwiches and salads designed for park wandering.',null,'open',true),
('demo-tenderloin-pho','Tenderloin Satellite Pho','Vietnamese',37.7834,-122.4142,'common',150,50,1550,array['pho','noodles','comfort'],'Aromatic noodle soups and crisp herb-filled rolls.',null,'open',true),
('demo-bernal-brunch','Bernal Solstice Brunch','Brunch',37.7420,-122.4148,'rare',400,50,2000,array['brunch','coffee','family'],'Sunny breakfast plates with house breads and preserves.',null,'open',true),
('demo-japantown-sushi','Japantown Stardust Sushi','Japanese',37.7855,-122.4298,'legendary',1200,50,3200,array['sushi','special-occasion','seafood'],'A concise chef-selected sushi experience using seasonal fish.',null,'open',true),
('demo-excelsior-pupusa','Excelsior Eclipse Pupusas','Salvadoran',37.7248,-122.4342,'common',150,50,1250,array['pupusas','casual','family'],'Griddled pupusas with bright curtido and house salsas.',null,'open',true)
on conflict (id) do update set
name = excluded.name, cuisine = excluded.cuisine, latitude = excluded.latitude, longitude = excluded.longitude,
rarity = excluded.rarity, discovery_xp = excluded.discovery_xp, reward_cents = excluded.reward_cents,
estimated_meal_cents = excluded.estimated_meal_cents, tags = excluded.tags, description = excluded.description,
image_url = excluded.image_url, availability = excluded.availability, is_synthetic = excluded.is_synthetic;
