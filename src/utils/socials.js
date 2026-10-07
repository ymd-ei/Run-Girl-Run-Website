// Where each social link shows. Site settings → Social links has a "Show on"
// checkbox per place; unticking one stores link.hide[place] = true, so links
// saved before this existed (no `hide`) still show everywhere.
// (The social feed reads every link regardless — this is only about display.)
export const PLACES = [
  ['contact', 'Contact panel'],     // desktop + phone contact section
  ['links', 'Links page'],          // rungirlrun.studio/links
  ['modelling', 'Modelling site'],  // modelling/ contact overlay
];

export const showsOn = (link, place) => !(link && link.hide && link.hide[place]);
