/* ==========================================================================
   THE KOCEYAN — museum content
   Everything on the site is generated from this file.
   To add a piece: drop the full image in /img and a ~900px copy in /img/t
   (same name, .webp), then add an entry below.
   ========================================================================== */

const ARTIST = {
  name: "Alex Koceyan",
  location: "Metro Detroit, Michigan",
  email: "alexkoc22@gmail.com",
  phone: "248-891-4063",
  bio: "Alex Koceyan is an illustrator, designer, and muralist based in Metro Detroit. He works across a variety of visual styles, creating everything from illustrations and graphic identities to large-scale murals. Alex earned his BFA from Wayne State University, studying Painting and Drawing with minors in Illustration and Graphic Design.",
  facts: [
    ["Based in", "Metro Detroit, MI"],
    ["Education", "BFA, Wayne State University"],
    ["Major", "Painting & Drawing"],
    ["Minors", "Illustration · Graphic Design"],
    ["Practice", "Illustration · Identity · Murals"],
  ],
};

/* ---------- Gallery I : Illustration -------------------------------------
   rooms: characters | storytelling | commercial | screenprint
   Titles are working titles (the old site had none) — rename freely.      */
const ROOMS = {
  characters:   { label: "Characters",   code: "A", blurb: "Heroes, villains, and the people in between." },
  storytelling: { label: "Storytelling", code: "B", blurb: "Covers, scenes, and worlds that want a sequel." },
  commercial:   { label: "Commercial",   code: "C", blurb: "Illustration with a job to do." },
  screenprint:  { label: "Screen Print", code: "D", blurb: "Folk motifs, flat color, layered ink." },
};

const ILLUSTRATIONS = [
  { id: "il-07", title: "Pomegranate Peacock",        rooms: ["screenprint"],                medium: "Screen print design" },
  { id: "il-12", title: "Wolverine",                  rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-03", title: "The Tale of Fly & Frog",     rooms: ["storytelling"],               medium: "Book cover · illustration and story" },
  { id: "il-16", title: "Spider-Punk",                rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-08", title: "NV 51¢ — Grocery Run",        rooms: ["commercial"],                 medium: "Stamp illustration" },
  { id: "il-02", title: "Old English D",              rooms: ["screenprint"],                medium: "Screen print design" },
  { id: "il-11", title: "The Seeker — First Issue",   rooms: ["characters", "storytelling"], medium: "Comic cover" },
  { id: "il-13", title: "Storm",                      rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-22", title: "The Chef",                   rooms: ["commercial"],                 medium: "Editorial illustration" },
  { id: "il-17", title: "Saber & Vestments",          rooms: ["characters"],                 medium: "Digital painting" },
  { id: "il-06", title: "Peacock Under the Tree",     rooms: ["screenprint"],                medium: "Screen print design" },
  { id: "il-04", title: "Portrait in Glasses",        rooms: ["characters"],                 medium: "Digital portrait" },
  { id: "il-15", title: "Spider-Man 2099",            rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-23", title: "The Clergy",                 rooms: ["storytelling"],               medium: "Digital painting" },
  { id: "il-09", title: "NV 51¢ — Desk Job",           rooms: ["commercial"],                 medium: "Stamp illustration" },
  { id: "il-19", title: "Dwarf Warrior",              rooms: ["characters"],                 medium: "Digital painting" },
  { id: "il-01", title: "Tree of Life",               rooms: ["screenprint"],                medium: "Screen print design" },
  { id: "il-14", title: "Cyclops",                    rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-21", title: "Spring Rabbit for Marlenka", rooms: ["commercial"],                 medium: "Commercial illustration" },
  { id: "il-18", title: "The Wanderer",               rooms: ["characters"],                 medium: "Digital painting" },
  { id: "il-24", title: "The Deep",                   rooms: ["storytelling"],               medium: "Digital painting" },
  { id: "il-05", title: "Blue Light",                 rooms: ["commercial"],                 medium: "Digital illustration" },
  { id: "il-20", title: "Leonardo",                   rooms: ["characters"],                 medium: "Digital illustration" },
  { id: "il-10", title: "C&A Dogsitting Co.",         rooms: ["commercial"],                 medium: "Flyer illustration" },
];

/* ---------- Gallery II : Graphic Design ---------------------------------- */
// mat: "dark" for light-colored logos on transparent backgrounds
const PROJECTS = [
  {
    slug: "luxor", title: "Luxor Jewelry", kind: "Logo Redesign · Packaging",
    hero: "luxor-2",
    text: "This logo redesign was about telling a story and respecting the jewelry business’s history. Rather than starting over, bits and pieces from past logos were used as inspiration to create something new. The final mark feels recognizable, bold, and strong enough to stand on its own.",
    images: ["luxor-2", "luxor-12", "luxor-10", "luxor-11", "luxor-7", "luxor-8", "luxor-3", "luxor-9", "luxor-13", "luxor-4", "luxor-5", "luxor-6", "luxor-1"],
    dark: ["luxor-10"],
  },
  {
    slug: "arakyal", title: "Arakyal", kind: "Brand Identity · Apparel",
    hero: "arakyal-2",
    text: "This project was created for a Toronto-based clothing brand, developing a visual identity that felt bold, distinct, and true to the brand’s character. The work included a custom type-based logo, a modified wordmark, a specialized cross symbol, and artwork for an upcoming collection.",
    images: ["arakyal-2", "arakyal-1", "arakyal-4", "arakyal-3", "arakyal-5", "arakyal-6"],
  },
  {
    slug: "armstrong", title: "Christian Armstrong", kind: "Campaign Identity · Yard Sign",
    hero: "armstrong-2",
    text: "I was commissioned by a city council candidate from Taylor, Michigan, to design a campaign yard sign that would be used throughout the city. The design centered on the Armstrong last name as a clear visual hook, focusing on immediate recognition and legibility at a distance. The sign was used citywide during the official campaign period, and the candidate went on to win the election for the city council.",
    images: ["armstrong-2", "armstrong-1", "armstrong-6", "armstrong-3", "armstrong-4", "armstrong-5", "armstrong-7"],
    badge: "Candidate won",
  },
  {
    slug: "hayko", title: "DJ Hayko", kind: "Logo System · Flyers · Social",
    hero: "hayko-4",
    text: "This project began as an exploration of branding within music and event culture, centered around DJ Hayko. I designed a logo system, event flyers, and Instagram post mockups, then pushed the identity into real-world space through photo-manipulated downtown scenes. The work reflects my interest in building brands that feel physical, lived-in, and unmistakably present beyond the screen.",
    images: ["hayko-4", "hayko-1", "hayko-2", "hayko-3", "hayko-7", "hayko-5", "hayko-6", "hayko-8"],
    dark: ["hayko-1"],
  },
  {
    slug: "lia-lucine", title: "Lia Lucine", kind: "Logo · Brand Identity",
    hero: "lia-2",
    text: "The logo for Lia Lucine, a handmade leather belt brand, was inspired by the stitching. I turned the letters into a smooth, seamless design that feels like part of the belt, and chose a typeface to complement the logo and the brand’s handcrafted elegance. The result is a simple, elegant mark that reflects the care behind each piece. Mockups were also made to show how the logo comes to life in real-world settings and across the brand.",
    images: ["lia-2", "lia-1", "lia-3", "lia-4", "lia-5", "lia-6", "lia-7", "lia-8"],
  },
  {
    slug: "marlenka", title: "Marlenka", kind: "Marketing · Print · Email",
    hero: "marlenka-1",
    text: "I worked within the brand’s established visual identity to create a range of marketing and print materials. This included email designs, order package inserts, and business cards, all developed to maintain consistency while adapting the brand across different formats and use cases. The work focused on clear communication, visual cohesion, and translating existing brand assets into effective, customer-facing designs.",
    images: ["marlenka-1", "marlenka-2", "marlenka-3", "marlenka-4", "marlenka-5", "marlenka-6", "marlenka-7", "marlenka-8", "marlenka-11", "marlenka-12", "marlenka-9", "marlenka-10"],
  },
  {
    slug: "home-detroit", title: "Home Detroit & Detroit Progress", kind: "Merchandise Design · Internship",
    hero: "home-1",
    text: "I interned as a merchandise designer for two partnered real estate companies, Home Detroit and Detroit Progress. Using provided logos, colors, and typefaces, I created 50 initial concepts for each company and refined nine final designs based on feedback. The results were merchandise designs that aligned with each company’s visual identity and branding.",
    images: ["home-1", "home-2", "home-3", "home-4", "home-5", "home-6", "home-7", "home-8", "home-9"],
    badge: "100 concepts",
  },
];

/* ---------- The Mural Yard ----------------------------------------------- */
const MURALS_INTRO = "I create murals for businesses, working with each client to develop a design that fits their space and vision. Every project starts with a different idea, whether it’s a specific request or an opportunity to create a more original concept. I bring my own creative perspective to each design while keeping the needs of the project in mind.";

const MURALS = [
  {
    slug: "coca-cola", title: "Drink Coca-Cola", where: "Interior · reclaimed wood planks",
    hero: "mural-coke-finished", process: ["mural-coke-process"],
    text: "I was asked to paint a Coca-Cola logo and bottle, with the goal of making the sign look like it had been there for decades, similar to a vintage ghost sign. The existing wooden planks helped bring that aged look to life. The client was so happy with the result that I returned to paint a second wall, which I was asked not to share online at the client’s request.",
    stamp: "Repeat client",
  },
  {
    slug: "ridesmith", title: "Ridesmith Service Center", where: "Interior · bike shop",
    hero: "mural-ridesmith-1", process: ["mural-ridesmith-3", "mural-ridesmith-2"],
    text: "Ridesmith wanted a hand-painted service sign that they could show clients during tours of their bike shop. After discussing what they wanted to include, I developed several design mockups for them to choose from. They ultimately went with the design featuring gears climbing up the wall, incorporating the shop’s focus on bike repair into the artwork.",
    stamp: "Hand-painted",
  },
  {
    slug: "birds", title: "Birds & Foliage", where: "Exterior · gas station",
    hero: "mural-birds-day", process: ["mural-birds-night"],
    text: "I approached the business with the idea of creating a mural for their exterior, with the goal of bringing something unexpected to a space typically dominated by standard signage and branding. I developed a proposed concept built around colorful birds and foliage, reimagining the gas station exterior as a more visually engaging space.",
    stamp: "Artist-pitched",
  },
  {
    slug: "smoke", title: "Smoke Scene", where: "Interior · smoke shop",
    hero: "mural-smoke", process: ["mural-smoke-sketch"],
    text: "The business owner’s request was “something with Marlboro and vape.” I developed a proposed mural concept featuring a man and woman in a stylized setting, with smoke incorporated into the overall design. The goal was to take the request beyond a typical advertisement and turn it into a scene with its own character.",
    stamp: "From sketch to wall",
  },
];
