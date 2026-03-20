/**
 * Parsed/display fields for window item specs — shared by project details and quote preview.
 * Glass/flange parsing matches project desktop table; missile uses DB field then description.
 */
function getWindowItemDisplaySpecs(item) {
  const desc = (item && item.description) || '';

  let glassType = '—';
  let glassColor = '—';
  let lowE = 'NO';
  let missileType = '—';
  let glassDescription = '';
  let flangeSize = 'N/A';

  if (desc) {
    const glassTypeMatch = desc.match(/Glass Type:\s*([^-]+)/);
    if (glassTypeMatch) {
      glassType = glassTypeMatch[1].trim();
    }
    const glassDescMatch = desc.match(/Glass Type:\s*[^-]+-\s*(.+?)(?:\n|$)/);
    if (glassDescMatch) {
      glassDescription = glassDescMatch[1].trim();
    }
    const flangeMatch = desc.match(/Flanged:\s*([^\n]+)/);
    if (flangeMatch) {
      let fs = flangeMatch[1].trim().replace(/\n/g, '').trim();
      fs = fs.replace(/"+$/, '') + '"';
      flangeSize = fs;
    }
    const le = desc.match(/Low\s*E:\s*([^\n]+)/i);
    if (le) lowE = le[1].trim();
    const gc = desc.match(/Glass\s*Color:\s*([^\n]+)/i);
    if (gc) glassColor = gc[1].trim();
  }

  if (item.missileType === 'LMI') {
    missileType = 'LMI';
  } else if (item.missileType === 'SMI') {
    missileType = 'SMI';
  } else if (desc) {
    if (/Missile Impact:\s*Large Missile Impact \(LMI\)/i.test(desc) || /Missile Impact:\s*LMI/i.test(desc)) {
      missileType = 'LMI';
    } else if (/Missile Impact:\s*Small Missile Impact \(SMI\)/i.test(desc) || /Missile Impact:\s*SMI/i.test(desc)) {
      missileType = 'SMI';
    }
  }

  const aluminumColor = item.color && item.color !== 'Various' ? item.color : '—';
  const windowSystemType = item.style || (item.windowSystem && item.windowSystem.type) || '—';

  return {
    glassType,
    glassColor,
    lowE,
    missileType,
    glassDescription,
    flangeSize,
    aluminumColor,
    windowSystemType
  };
}

module.exports = { getWindowItemDisplaySpecs };
