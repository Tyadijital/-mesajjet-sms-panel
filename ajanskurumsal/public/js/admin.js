window.prettyJson = function (form) {
  try {
    const svc = form.querySelector('textarea[name="servicesJson"]');
    const prj = form.querySelector('textarea[name="projectsJson"]');
    if (svc) svc.value = JSON.stringify(JSON.parse(svc.value), null, 2);
    if (prj) prj.value = JSON.stringify(JSON.parse(prj.value), null, 2);
    alert('JSON biçimlendirildi');
  } catch (e) {
    alert('JSON hatası: ' + e.message);
  }
};