export const products = [
  {
    id: 'christ-is-king-tee',
    slug: 'christ-is-king-tee',
    category: 'T-Shirts',
    type: 'Tee',
    name: 'Christ Is King Tee',
    description: 'Bold faith-forward graphic tee with high-contrast white artwork. Choose your size, submit your order, and pay direct.',
    price: 35,
    images: ['./assets/Christ_Is_King_White.png', mockBack('CHRIST IS KING')],
    sizes: ['S','M','L','XL','XXL']
  },
  {
    id: 'prestige-luxury-tee',
    slug: 'prestige-luxury-tee',
    category: 'T-Shirts',
    type: 'Tee',
    name: 'Prestige Luxury Tee',
    description: 'Luxury streetwear graphic with a clean premium feel. Built for a sharp everyday fit.',
    price: 38,
    images: ['./assets/Prestige_Luxury_Fashion.png', mockBack('PRESTIGE')],
    sizes: ['S','M','L','XL','XXL']
  },
  {
    id: 'christ-is-king-hoodie',
    slug: 'christ-is-king-hoodie',
    category: 'Hoodies',
    type: 'Hoodie',
    name: 'Christ Is King Hoodie',
    description: 'Heavyweight fleece hoodie featuring the Christ Is King artwork. Clean, bold, and warm.',
    price: 70,
    images: [mockHoodie('Christ Is King', 'KING'), mockBack('CHRIST IS KING')],
    sizes: ['S','M','L','XL','XXL']
  },
  {
    id: 'prestige-luxury-hoodie',
    slug: 'prestige-luxury-hoodie',
    category: 'Hoodies',
    type: 'Hoodie',
    name: 'Prestige Luxury Hoodie',
    description: 'Premium hoodie option for the Prestige graphic. Direct-pay ordering so checkout stays painless.',
    price: 75,
    images: [mockHoodie('Prestige Luxury', 'PL'), mockBack('PRESTIGE')],
    sizes: ['S','M','L','XL','XXL']
  }
];

function mockTee(label, top, bottom){
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200' viewBox='0 0 1200 1200'>
    <rect width='1200' height='1200' fill='#ededed'/>
    <ellipse cx='600' cy='1015' rx='300' ry='38' fill='#000' opacity='.10'/>
    <path d='M390 190 L505 130 H695 L810 190 L985 330 L875 492 L790 440 V980 H410 V440 L325 492 L215 330 Z' fill='#070707'/>
    <path d='M505 130 C535 205 665 205 695 130' fill='none' stroke='#1d1d1d' stroke-width='28' stroke-linecap='round'/>
    <text x='600' y='515' text-anchor='middle' font-family='Arial Black, Impact, sans-serif' font-size='108' fill='#fff'>${top}</text>
    <text x='600' y='600' text-anchor='middle' font-family='Arial Black, Impact, sans-serif' font-size='62' fill='#fff' letter-spacing='8'>${bottom}</text>
    <text x='600' y='745' text-anchor='middle' font-family='Arial, sans-serif' font-size='32' fill='#fff' opacity='.65'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function mockHoodie(label, mark){
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200' viewBox='0 0 1200 1200'>
    <rect width='1200' height='1200' fill='#ededed'/>
    <ellipse cx='600' cy='1030' rx='330' ry='42' fill='#000' opacity='.10'/>
    <path d='M455 265 C475 145 725 145 745 265 C850 292 930 415 958 602 L835 645 C810 515 770 460 735 445 V988 H465 V445 C430 460 390 515 365 645 L242 602 C270 415 350 292 455 265 Z' fill='#080808'/>
    <path d='M482 285 C520 205 680 205 718 285' fill='none' stroke='#202020' stroke-width='30' stroke-linecap='round'/>
    <rect x='510' y='675' width='180' height='115' rx='30' fill='#242424'/>
    <text x='600' y='545' text-anchor='middle' font-family='Arial Black, Impact, sans-serif' font-size='104' fill='#fff'>${mark}</text>
    <text x='600' y='845' text-anchor='middle' font-family='Arial, sans-serif' font-size='34' fill='#fff' opacity='.65'>${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function mockBack(text){
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1200' viewBox='0 0 1200 1200'>
    <rect width='1200' height='1200' fill='#ededed'/>
    <rect x='280' y='230' width='640' height='760' fill='#090909'/>
    <text x='600' y='555' text-anchor='middle' font-family='Arial Black, Impact, sans-serif' font-size='88' fill='#fff'>${text}</text>
    <text x='600' y='640' text-anchor='middle' font-family='Arial, sans-serif' font-size='30' fill='#fff' opacity='.65'>BACK PRINT PREVIEW</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}
