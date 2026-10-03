export type MenuItem = {
  name: string;
  note: string;
  cents: number;
};

export type VenueMenu = {
  items: MenuItem[];
  notes: { quote: string; by: string }[];
};

const MENUS: Record<string, VenueMenu> = {
  rst_lantern: {
    items: [
      { name: "Chili oil dumplings", note: "Eight, pork and shrimp", cents: 1600 },
      { name: "Cucumber smash", note: "Garlic, black vinegar", cents: 900 },
      { name: "Hot and sour soup", note: "Cup", cents: 700 },
      { name: "Scallion pancake", note: "Crisp, with soy", cents: 800 },
    ],
    notes: [
      { quote: "The chili oil is the whole reason to walk over.", by: "Mina" },
      { quote: "Dumplings arrived still steaming. Worth the wait.", by: "Andre" },
    ],
  },
  rst_crane: {
    items: [
      { name: "Pork bao", note: "Two, with pickled mustard", cents: 1100 },
      { name: "Mushroom bao", note: "Two, hoisin", cents: 1000 },
      { name: "Cucumber salad", note: "Sesame", cents: 700 },
      { name: "Barley tea", note: "Iced", cents: 400 },
    ],
    notes: [
      { quote: "Soft buns, not too sweet. Easy lunch.", by: "Priya" },
      { quote: "Grabbed a window seat and stayed for tea.", by: "Chris" },
    ],
  },
  rst_fog: {
    items: [
      { name: "Tonkotsu ramen", note: "Rich broth, extra noodles", cents: 1900 },
      { name: "Spicy miso ramen", note: "Chili paste on the side", cents: 1800 },
      { name: "Pork gyoza", note: "Five", cents: 900 },
      { name: "Cold brew", note: "House", cents: 500 },
    ],
    notes: [
      { quote: "Broth is cloudy in the best way.", by: "Elena" },
      { quote: "Gyoza skins actually shatter. Order them.", by: "Noah" },
    ],
  },
  rst_miso: {
    items: [
      { name: "Miso salmon bowl", note: "Rice, greens, egg", cents: 1700 },
      { name: "Tamago set", note: "Sweet egg, pickles", cents: 1400 },
      { name: "Seaweed salad", note: "Sesame", cents: 800 },
      { name: "Hojicha", note: "Hot", cents: 400 },
    ],
    notes: [
      { quote: "Quiet in the morning. The salmon is glazed, not burnt.", by: "Jules" },
      { quote: "A proper breakfast if you are already downtown.", by: "Sam" },
    ],
  },
  rst_saffron: {
    items: [
      { name: "Butter chicken", note: "With rice or naan", cents: 1800 },
      { name: "Chana masala", note: "Chickpeas, tangy", cents: 1500 },
      { name: "Garlic naan", note: "One", cents: 500 },
      { name: "Mango lassi", note: "Not too sweet", cents: 600 },
    ],
    notes: [
      { quote: "The naan comes out blistered. Share it.", by: "Asha" },
      { quote: "Spice is honest. Ask if you want it hotter.", by: "Leo" },
    ],
  },
  rst_olive: {
    items: [
      { name: "Lamb plate", note: "Rice, herbs, yogurt", cents: 2100 },
      { name: "Falafel plate", note: "Salad and tahini", cents: 1600 },
      { name: "Mezze trio", note: "Hummus, olives, pita", cents: 1400 },
      { name: "Mint lemonade", note: "Tart", cents: 500 },
    ],
    notes: [
      { quote: "Mezze is enough for two if you also get the lamb.", by: "Rae" },
      { quote: "Bright room, good for a slow lunch.", by: "Omar" },
    ],
  },
  rst_basil: {
    items: [
      { name: "Tagliatelle", note: "Basil and lemon", cents: 2200 },
      { name: "Margherita", note: "For the table", cents: 1900 },
      { name: "Bitter greens", note: "Chili, parmesan", cents: 1100 },
      { name: "Affogato", note: "Espresso over gelato", cents: 800 },
    ],
    notes: [
      { quote: "Pasta was properly salted. Rare around here.", by: "Giulia" },
      { quote: "Sit outside if the wind is down.", by: "Mark" },
    ],
  },
  rst_coal: {
    items: [
      { name: "Pepperoni pie", note: "12 inch, cup-and-char", cents: 2000 },
      { name: "Mushroom pie", note: "Garlic oil", cents: 1900 },
      { name: "Side salad", note: "Fennel", cents: 800 },
      { name: "House soda", note: "Blood orange", cents: 400 },
    ],
    notes: [
      { quote: "Crust has real blister. Worth the walk from the square.", by: "Dev" },
      { quote: "Pepperoni cups hold the grease. That's a compliment.", by: "Lana" },
    ],
  },
  rst_tide: {
    items: [
      { name: "Crudo", note: "Citrus, olive oil", cents: 2200 },
      { name: "Grilled fish", note: "Market catch, greens", cents: 3200 },
      { name: "Fries", note: "Herb salt", cents: 800 },
      { name: "Seltzer", note: "Lemon", cents: 400 },
    ],
    notes: [
      { quote: "Fish tastes like it came in this morning.", by: "Helen" },
      { quote: "Save room. The crudo is the better order.", by: "Ibrahim" },
    ],
  },
  rst_gold: {
    items: [
      { name: "Al pastor tacos", note: "Three, pineapple", cents: 1400 },
      { name: "Mushroom tacos", note: "Three, salsa verde", cents: 1300 },
      { name: "Elote", note: "Cotija, chili", cents: 600 },
      { name: "Horchata", note: "Not too sweet", cents: 450 },
    ],
    notes: [
      { quote: "Pastor has actual char, not just spice.", by: "Luz" },
      { quote: "Standing room at sunset, and it's still worth it.", by: "Ben" },
    ],
  },
  rst_clay: {
    items: [
      { name: "Short rib stew", note: "Clay pot, rice", cents: 2600 },
      { name: "Kimchi pancake", note: "Crisp edge", cents: 1400 },
      { name: "Banchan set", note: "Changes daily", cents: 700 },
      { name: "Barley tea", note: "Cold", cents: 300 },
    ],
    notes: [
      { quote: "The stew is a project. Come hungry.", by: "Soo" },
      { quote: "Pancake is the thing I tell people about.", by: "Matt" },
    ],
  },
  rst_cedar: {
    items: [
      { name: "Lamb kibbeh", note: "Four, pine nuts", cents: 1600 },
      { name: "Pomegranate chicken", note: "With freekeh", cents: 2400 },
      { name: "Fattoush", note: "Crisp pita", cents: 1100 },
      { name: "Cardamom coffee", note: "Small", cents: 500 },
    ],
    notes: [
      { quote: "Fattoush is sharp and cold. Get it with the chicken.", by: "Nadia" },
      { quote: "Smells like cedar the second you walk in.", by: "Owen" },
    ],
  },
  rst_plantain: {
    items: [
      { name: "Jerk chicken", note: "Rice and peas", cents: 1900 },
      { name: "Fried plantains", note: "Sweet, with lime", cents: 800 },
      { name: "Callaloo", note: "Side", cents: 700 },
      { name: "Ginger beer", note: "Spicy", cents: 500 },
    ],
    notes: [
      { quote: "Plantains are caramelized, not mushy.", by: "Alicia" },
      { quote: "Ginger beer has a kick. Order it.", by: "Theo" },
    ],
  },
  rst_rye: {
    items: [
      { name: "Smash burger", note: "American cheese, pickles", cents: 1600 },
      { name: "Rye grilled cheese", note: "Sharp cheddar", cents: 1300 },
      { name: "Little salad", note: "Dill", cents: 800 },
      { name: "Chocolate shake", note: "Malt", cents: 700 },
    ],
    notes: [
      { quote: "Burger is smashed thin and salty. That's the point.", by: "June" },
      { quote: "Counter seats are the good ones.", by: "Paul" },
    ],
  },
  rst_honey: {
    items: [
      { name: "Honey butter bun", note: "Warm, one", cents: 500 },
      { name: "Morning bun", note: "Orange zest", cents: 550 },
      { name: "Egg sandwich", note: "On the bun", cents: 1100 },
      { name: "Drip coffee", note: "Bottomless until 11", cents: 400 },
    ],
    notes: [
      { quote: "Get there before the honey buns sell out.", by: "Claire" },
      { quote: "Butter on the paper, which is how you know.", by: "Hugo" },
    ],
  },
  rst_violet: {
    items: [
      { name: "Rare beef pho", note: "Large, herbs", cents: 1600 },
      { name: "Tofu pho", note: "Same broth", cents: 1500 },
      { name: "Summer rolls", note: "Two, peanut sauce", cents: 900 },
      { name: "Iced coffee", note: "Sweetened condensed", cents: 500 },
    ],
    notes: [
      { quote: "Broth is clean. Herbs are not an afterthought.", by: "Linh" },
      { quote: "Big bowl, fair price, no fuss.", by: "Derek" },
    ],
  },
  rst_cinder: {
    items: [
      { name: "Hanger steak", note: "Charred, pepper", cents: 3800 },
      { name: "Half chicken", note: "Ember roasted", cents: 2800 },
      { name: "Charred greens", note: "Lemon", cents: 1200 },
      { name: "Sparkling water", note: "Large", cents: 500 },
    ],
    notes: [
      { quote: "Steak has a real crust. Ask for medium-rare.", by: "Ruth" },
      { quote: "Loud room, serious food. Go with someone.", by: "Calvin" },
    ],
  },
  rst_jar: {
    items: [
      { name: "Grain bowl", note: "Tahini, pickles, egg", cents: 1700 },
      { name: "Tomato toast", note: "Chili crisp", cents: 1200 },
      { name: "Greens", note: "Lemon, seeds", cents: 1000 },
      { name: "Kombucha", note: "Ginger", cents: 600 },
    ],
    notes: [
      { quote: "Doesn't taste like a compromise. The chili crisp helps.", by: "Maya" },
      { quote: "Good stop if you want something that isn't fried.", by: "Evan" },
    ],
  },
};

const FALLBACK: VenueMenu = {
  items: [
    { name: "House plate", note: "The thing they are known for", cents: 1800 },
    { name: "Small side", note: "Changes with the market", cents: 800 },
    { name: "Something cold", note: "To drink", cents: 500 },
  ],
  notes: [{ quote: "A demo stop on the Relay map.", by: "Relay" }],
};

export function venueMenu(id: string): VenueMenu {
  return MENUS[id] ?? FALLBACK;
}
