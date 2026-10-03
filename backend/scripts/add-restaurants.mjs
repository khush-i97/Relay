// One-off: appends the expanded synthetic SF catalog to shared/fixtures.json (idempotent by id).
import { readFileSync, writeFileSync } from "node:fs";

const XP = { common: 150, rare: 400, epic: 800, legendary: 1200 };
// [id, name, cuisine, lat, lng, rarity, mealDollars, tags, description]
const rows = [
  ["demo-valencia-tortas", "Valencia Quasar Tortas", "Mexican", 37.7617, -122.4216, "common", 13, ["sandwiches", "spicy", "casual"], "Pressed tortas stacked with slow-braised meats and pickled jalapeños."],
  ["demo-24th-mole", "24th Street Gravity Mole", "Mexican", 37.7525, -122.4150, "rare", 22, ["mole", "family", "date-night"], "Seven-mole tasting plates with handmade blue corn tortillas."],
  ["demo-inner-mission-churros", "Inner Mission Comet Churros", "Dessert", 37.7650, -122.4190, "common", 8, ["dessert", "sweet", "late-night"], "Crisp cinnamon churros with dark chocolate and cajeta dips."],
  ["demo-hayes-wine-bar", "Hayes Valley Halo Small Plates", "Californian", 37.7765, -122.4241, "rare", 34, ["date-night", "wine", "seasonal"], "Market small plates and natural wine in a candlelit room."],
  ["demo-hayes-ice-cream", "Hayes Orbit Creamery", "Dessert", 37.7760, -122.4255, "common", 7, ["ice-cream", "sweet", "family"], "Small-batch ice cream with rotating local fruit flavors."],
  ["demo-lower-haight-falafel", "Lower Haight Pulsar Falafel", "Middle Eastern", 37.7717, -122.4310, "common", 12, ["falafel", "vegan", "quick"], "Herb-green falafel wraps with tahini and pickled turnips."],
  ["demo-cole-valley-cafe", "Cole Valley Corona Cafe", "Cafe", 37.7656, -122.4500, "common", 10, ["coffee", "breakfast", "cozy"], "Neighborhood espresso bar with cardamom buns and toast."],
  ["demo-inner-sunset-udon", "Inner Sunset Nebula Udon", "Japanese", 37.7639, -122.4687, "rare", 18, ["noodles", "udon", "comfort"], "Thick hand-pulled udon in dashi with crisp tempura."],
  ["demo-outer-sunset-surf", "Outer Sunset Tide Tacos", "Mexican", 37.7530, -122.4950, "common", 14, ["fish-tacos", "seafood", "beach"], "Beer-battered fish tacos for after a foggy surf session."],
  ["demo-outer-sunset-coffee", "Outer Sunset Fogline Roasters", "Cafe", 37.7600, -122.4940, "common", 9, ["coffee", "pastry", "beach"], "Single-origin pour-overs and morning buns near the ocean."],
  ["demo-parkside-dim-sum", "Parkside Lantern Dim Sum", "Chinese", 37.7420, -122.4880, "rare", 21, ["dim-sum", "shared", "family"], "Steaming carts of har gow, siu mai, and egg tarts."],
  ["demo-west-portal-trattoria", "West Portal Polaris Trattoria", "Italian", 37.7405, -122.4660, "common", 24, ["pasta", "family", "cozy"], "Old-school red-sauce trattoria with garlic bread towers."],
  ["demo-clement-hotpot", "Clement Street Supernova Hot Pot", "Chinese", 37.7828, -122.4600, "epic", 32, ["hot-pot", "spicy", "shared"], "Bubbling Sichuan hot pot with numbing mala broth."],
  ["demo-clement-burmese", "Clement Eclipse Burmese Kitchen", "Burmese", 37.7830, -122.4625, "rare", 23, ["tea-leaf-salad", "spicy", "shared"], "Tea leaf salad, garlic noodles, and coconut chicken curry."],
  ["demo-outer-richmond-pho", "Outer Richmond Starlight Pho", "Vietnamese", 37.7780, -122.4930, "common", 15, ["pho", "noodles", "comfort"], "Rich beef pho and lemongrass grilled pork vermicelli."],
  ["demo-geary-korean-bbq", "Geary Boulevard Meteor BBQ", "Korean", 37.7810, -122.4720, "rare", 35, ["korean-bbq", "grill", "shared"], "Tabletop grills with marinated galbi and endless banchan."],
  ["demo-fillmore-jazz-soul", "Fillmore Jazz Satellite Soul Food", "Southern", 37.7840, -122.4330, "epic", 26, ["fried-chicken", "comfort", "live-music"], "Fried chicken and waffles with a live jazz soundtrack."],
  ["demo-pac-heights-brunch", "Pacific Heights Zenith Brunch", "Brunch", 37.7920, -122.4350, "rare", 25, ["brunch", "eggs", "coffee"], "Soufflé pancakes and herby egg plates with bay views."],
  ["demo-cow-hollow-oysters", "Cow Hollow Comet Oyster Bar", "Seafood", 37.7975, -122.4360, "epic", 38, ["oysters", "seafood", "date-night"], "Chilled oysters, crudo, and crisp white wine."],
  ["demo-russian-hill-crepes", "Russian Hill Cosmos Crêperie", "French", 37.8010, -122.4190, "common", 14, ["crepes", "sweet", "breakfast"], "Buckwheat galettes and Nutella crêpes folded to order."],
  ["demo-nob-hill-steak", "Nob Hill Orion Steakhouse", "Steakhouse", 37.7920, -122.4150, "legendary", 68, ["steak", "special-occasion", "fancy"], "Dry-aged steaks and tableside Caesar under chandeliers."],
  ["demo-polk-thai", "Polk Gulch Rocket Thai", "Thai", 37.7880, -122.4205, "common", 16, ["thai", "spicy", "noodles"], "Fiery pad kee mao and jungle curry, open late."],
  ["demo-polk-ramen", "Polk Street Black Hole Ramen", "Japanese", 37.7895, -122.4210, "rare", 19, ["ramen", "noodles", "spicy"], "Black garlic tonkotsu ramen with a molten egg."],
  ["demo-union-square-bistro", "Union Square Constellation Bistro", "French", 37.7880, -122.4075, "rare", 36, ["bistro", "date-night", "wine"], "Steak frites and onion soup in a brass-railed bistro."],
  ["demo-fidi-salad", "FiDi Lightspeed Salads", "Californian", 37.7940, -122.3990, "common", 14, ["healthy", "vegan", "quick"], "Build-your-own grain salads for a fast workday lunch."],
  ["demo-ferry-oysters", "Ferry Dock Lunar Fish Market", "Seafood", 37.7930, -122.3960, "epic", 30, ["seafood", "waterfront", "chowder"], "Sourdough bread bowls of clam chowder by the water."],
  ["demo-soma-burgers", "SoMa Thrust Burgers", "American", 37.7760, -122.4100, "common", 15, ["burgers", "fries", "casual"], "Smash burgers, crinkle fries, and thick milkshakes."],
  ["demo-south-park-sandwich", "South Park Apogee Deli", "Sandwiches", 37.7815, -122.3940, "common", 13, ["sandwiches", "quick", "picnic"], "Overstuffed deli sandwiches to eat in the little oval park."],
  ["demo-mission-bay-poke", "Mission Bay Tidal Poke", "Hawaiian", 37.7700, -122.3920, "common", 16, ["poke", "seafood", "healthy"], "Ahi poke bowls with furikake and mango salsa."],
  ["demo-dogpatch-brewery", "Dogpatch Booster Beer Hall", "American", 37.7610, -122.3900, "rare", 22, ["beer", "pretzels", "shared"], "House lagers with giant pretzels and beer-cheese dip."],
  ["demo-dogpatch-chocolate", "Dogpatch Dark Matter Chocolate", "Dessert", 37.7570, -122.3895, "rare", 9, ["chocolate", "dessert", "sweet"], "Bean-to-bar chocolate tasting flights and hot cocoa."],
  ["demo-bayview-bbq", "Bayview Afterburner Smokehouse", "Barbecue", 37.7300, -122.3900, "rare", 24, ["barbecue", "hearty", "spicy"], "Hot links, brisket, and peach cobbler from a backyard pit."],
  ["demo-bernal-pizza", "Bernal Heights Retrograde Pizza", "Pizza", 37.7390, -122.4180, "common", 19, ["pizza", "family", "casual"], "Detroit-style square pies with crispy cheese edges."],
  ["demo-glen-park-cafe", "Glen Park Canyon Cafe", "Cafe", 37.7340, -122.4330, "common", 11, ["coffee", "breakfast", "outdoors"], "Breakfast sandwiches to take on the canyon trail."],
  ["demo-noe-bagels", "Noe Valley Eclipse Bagels", "Bakery", 37.7510, -122.4310, "common", 10, ["bagels", "breakfast", "coffee"], "Wood-fired bagels with lox and scallion schmear."],
  ["demo-castro-thai", "Castro Star Thai Noodle", "Thai", 37.7625, -122.4348, "common", 15, ["thai", "noodles", "vegan"], "Boat noodle soup and crispy tofu pad see ew."],
  ["demo-duboce-gelato", "Duboce Park Galactic Gelato", "Dessert", 37.7695, -122.4330, "common", 7, ["gelato", "sweet", "family"], "Pistachio and stracciatella gelato made each morning."],
  ["demo-nopa-farm", "NoPa Equinox Farm Table", "Californian", 37.7750, -122.4400, "legendary", 52, ["seasonal", "wood-fired", "special-occasion"], "Wood-fired farm-to-table plates, booked weeks ahead."],
  ["demo-western-addition-ethiopian", "Western Addition Horizon Ethiopian", "Ethiopian", 37.7810, -122.4280, "rare", 20, ["injera", "shared", "vegan"], "Colorful injera platters of lentil wats and greens."],
  ["demo-tenderloin-banh-mi", "Tenderloin Rocketship Bánh Mì", "Vietnamese", 37.7850, -122.4170, "common", 9, ["sandwiches", "quick", "spicy"], "Crackly baguette bánh mì with lemongrass pork."],
  ["demo-tenderloin-yemeni", "Tenderloin Desert Star Yemeni", "Middle Eastern", 37.7840, -122.4130, "rare", 17, ["lamb", "spicy", "shared"], "Slow-roasted lamb haneeth and fluffy malawah bread."],
  ["demo-chinatown-bakery", "Chinatown Jade Moon Bakery", "Bakery", 37.7950, -122.4060, "common", 6, ["egg-tarts", "pastry", "sweet"], "Warm egg tarts and pineapple buns straight from the oven."],
  ["demo-chinatown-noodles", "Chinatown Dragon Comet Noodles", "Chinese", 37.7962, -122.4072, "rare", 14, ["noodles", "hand-pulled", "spicy"], "Hand-pulled biang biang noodles with chili oil."],
  ["demo-north-beach-espresso", "North Beach Starlight Espresso", "Cafe", 37.7990, -122.4070, "common", 8, ["coffee", "pastry", "historic"], "Beatnik-era espresso bar with tiramisu by the slice."],
  ["demo-north-beach-focaccia", "North Beach Telescope Focaccia", "Bakery", 37.8008, -122.4105, "rare", 9, ["focaccia", "pizza", "historic"], "Old-world focaccia slabs that sell out by noon."],
  ["demo-telegraph-hill-wine", "Telegraph Hill Skyline Enoteca", "Italian", 37.8020, -122.4060, "epic", 42, ["wine", "pasta", "date-night"], "Hillside enoteca with hand-cut pasta and city lights."],
  ["demo-wharf-crab", "Fisherman's Wharf Crab Constellation", "Seafood", 37.8080, -122.4170, "epic", 34, ["crab", "seafood", "waterfront"], "Whole Dungeness crab cracked fresh at the counter."],
  ["demo-embarcadero-dumplings", "Embarcadero Pier Pulsar Dumplings", "Chinese", 37.8030, -122.4020, "common", 15, ["dumplings", "soup-dumplings", "waterfront"], "Xiao long bao with ginger vinegar by the piers."],
  ["demo-potrero-pupuseria", "Potrero Hill Nova Pupuseria", "Salvadoran", 37.7590, -122.4000, "common", 12, ["pupusas", "casual", "family"], "Loroco-and-cheese pupusas with tangy curtido."],
  ["demo-portola-filipino", "Portola Sunburst Filipino Kitchen", "Filipino", 37.7270, -122.4060, "rare", 18, ["adobo", "comfort", "family"], "Chicken adobo, lumpia, and ube-halo-halo for dessert."],
  ["demo-visitacion-peruvian", "Visitacion Valley Andes Rotisserie", "Peruvian", 37.7140, -122.4100, "rare", 19, ["rotisserie", "spicy", "family"], "Pollo a la brasa with three ají sauces."],
  ["demo-excelsior-taqueria", "Excelsior Eventide Taqueria", "Mexican", 37.7230, -122.4310, "common", 11, ["burritos", "spicy", "late-night"], "Mission-style burritos the size of a small comet."],
  ["demo-ingleside-jamaican", "Ingleside Orbit Jerk Shack", "Caribbean", 37.7230, -122.4530, "rare", 17, ["jerk-chicken", "spicy", "comfort"], "Smoky jerk chicken with rice and peas and plantains."],
  ["demo-forest-hill-tea", "Forest Hill Moonrise Matcha", "Tea House", 37.7480, -122.4630, "common", 9, ["matcha", "tea", "quiet"], "Whisked matcha and mochi in a quiet hillside nook."],
  ["demo-haight-vegan", "Haight Street Aurora Vegan Diner", "Vegetarian", 37.7700, -122.4460, "common", 16, ["vegan", "burgers", "comfort"], "Plant-based burgers and seitan wings, open all day."],
  ["demo-japantown-crepes", "Japantown Prism Crepes", "Dessert", 37.7850, -122.4310, "common", 9, ["crepes", "sweet", "matcha"], "Harajuku-style crepes stuffed with matcha cream."],
  ["demo-laurel-heights-deli", "Laurel Heights Vector Deli", "Sandwiches", 37.7860, -122.4500, "common", 14, ["sandwiches", "picnic", "quick"], "Italian subs and pastrami ryes stacked high."],
  ["demo-marina-sushi", "Marina Polaris Sushi Bar", "Japanese", 37.8005, -122.4330, "epic", 40, ["sushi", "seafood", "date-night"], "Omakase-lite sushi with torched salmon nigiri."],
  ["demo-ggp-picnic", "Golden Gate Park Meadow Kiosk", "American", 37.7710, -122.4680, "common", 11, ["picnic", "outdoors", "family"], "Hot dogs and lemonade beside the concourse fountains."],
  ["demo-hunters-point-soul", "Hunters Point Starboard Soul Kitchen", "Southern", 37.7280, -122.3770, "rare", 19, ["fried-fish", "comfort", "waterfront"], "Cornmeal-fried catfish and collards near the shipyard."],
  ["demo-lakeshore-greek", "Lakeshore Halo Greek Grill", "Greek", 37.7240, -122.4790, "common", 17, ["gyros", "mezze", "quick"], "Gyros, spanakopita, and lemony roast potatoes."],
  ["demo-diamond-heights-pie", "Diamond Heights Summit Pie Shop", "Dessert", 37.7420, -122.4400, "legendary", 12, ["pie", "sweet", "coffee"], "Legendary sour cherry pie at the top of the hill."],
];

const path = new URL("../shared/fixtures.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(path, "utf8"));
const known = new Set(fixtures.map((restaurant) => restaurant.id));
let added = 0;
for (const [id, name, cuisine, latitude, longitude, rarity, mealDollars, tags, description] of rows) {
  if (known.has(id)) continue;
  fixtures.push({
    id, name, cuisine, latitude, longitude, rarity,
    discoveryXp: XP[rarity], rewardCents: 50, estimatedMealCents: Math.round(mealDollars * 100),
    tags, description, imageUrl: null, availability: "open", isSynthetic: true,
  });
  added += 1;
}
writeFileSync(path, JSON.stringify(fixtures, null, 2) + "\n");
console.log(`Added ${added} restaurants; catalog now has ${fixtures.length}`);
