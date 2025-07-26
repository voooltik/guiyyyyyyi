// app.js — с Яндекс.Картами и исправленным построением маршрута
let places = [];
let selectedTags = new Set();
let route = [];
let currentStep = 0;
let stage = "map"; // "map" или "info"
let mapInstance = null;
let tinderIndex = 0;

const categoryData = {
  "🖼 Культурное": {
    museum: "Музей",
    gallery: "Галерея",
    history: "Исторические места",
    monument: "Памятник"
  },
  "🍴 Еда и напитки": {
    restaurant: "Ресторан",
    cafe: "Кафе",
    bar: "Бар",
    streetfood: "Уличная еда"
  },
  "🎨 Современное и молодёжное": {
    streetart: "Стрит-арт",
    instagram: "Инстаграмные места",
    loft: "Креативные пространства",
    event: "Мероприятия / выставки",
    live: "Живая музыка"
  },
  "🚶 Активный отдых и прогулки": {
    park: "Парк",
    embankment: "Набережная",
    viewpoint: "Смотровая",
    walk: "Пешие маршруты",
    nature: "Природа"
  },
  "👪 Для компании / семьи": {
    withkids: "С детьми",
    date: "Для свидания",
    alone: "Для одиночных прогулок",
    group: "Для компании"
  },
  "🛍 Шопинг и сувениры": {
    market: "Рынки",
    souvenir: "Сувенирные лавки"
  }
};

function geocode(placeName) {
  return ymaps.geocode(placeName).then(res => {
    const obj = res.geoObjects.get(0);
    if (!obj) throw new Error("Место не найдено");
    return obj.geometry.getCoordinates();
  });
}

function renderRouteFromTo(startCoords, endCoords) {
  if (mapInstance) mapInstance.destroy();

  mapInstance = new ymaps.Map("map", {
    center: startCoords,
    zoom: 14,
    controls: ["zoomControl", "fullscreenControl"]
  });

  const startMark = new ymaps.Placemark(startCoords, {
    balloonContent: "Вы здесь"
  }, {
    preset: "islands#blueCircleIcon"
  });

  const endMark = new ymaps.Placemark(endCoords, {
    balloonContent: "Место назначения"
  }, {
    preset: "islands#redCircleIcon"
  });

  mapInstance.geoObjects.add(startMark);
  mapInstance.geoObjects.add(endMark);

  ymaps.route([startCoords, endCoords], { routingMode: 'pedestrian' })
    .then(route => {
      mapInstance.geoObjects.add(route);
      const bounds = route.getPaths().getBounds();
      if (bounds) mapInstance.setBounds(bounds, { checkZoomRange: true });
    })
    .catch(err => alert("Не удалось построить маршрут: " + err.message));
}

window.addEventListener("load", () => {
  const navButtons = {
    route: document.getElementById("nav-route"),
    promos: document.getElementById("nav-promos"),
    tinder: document.getElementById("nav-tinder")
  };

  const sections = {
    main: document.getElementById("main-section"),
    route: document.getElementById("route-display"),
    promos: document.getElementById("promos"),
    tinder: document.getElementById("tinder-section"),
    placeInfo: document.getElementById("place-info")
  };

  const resetNav = () => Object.values(navButtons).forEach(btn => btn.classList.remove("active"));

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      Object.values(sections).forEach(s => s.style.display = "none");
      resetNav();
      btn.classList.add("active");
      if (key === "route" && route.length === 0) {
        sections.main.style.display = "block";
        return;
      }
      sections[key].style.display = "block";
      if (key === "tinder") renderTinderCard();
    });
  });

  renderCategoryMenu();

  fetch("./places.json")
    .then(res => res.json())
    .then(data => {
      places = data;
      renderTinderCard();
    })
    .catch(() => alert("Не удалось загрузить места"));

  document.getElementById("show-route").addEventListener("click", () => {
    if (selectedTags.size === 0) return alert("Выберите хотя бы одну категорию");

    const age = document.getElementById("age").value;
    const duration = +document.getElementById("duration").value;
    const maxPlaces = duration * 2;
    const start = document.getElementById("startInput").value.trim() || "Советская площадь";

    route = places.filter(p =>
      p.tags.some(tag => selectedTags.has(tag)) && (age === "all" || p.age === age || p.age === "all")
    ).slice(0, maxPlaces);

    if (!route.length) return alert("Нет подходящих мест");

    currentStep = 0;
    stage = "map";
    sections.main.style.display = "none";
    sections.route.style.display = "block";
    resetNav();
    navButtons.route.classList.add("active");

    geocode(start)
      .then(startCoords => renderRouteFromTo(startCoords, route[0].coordinates))
      .then(() => showStep())
      .catch(() => {
        renderRouteFromTo([57.6261, 39.8845], route[0].coordinates);
        showStep();
      });
  });

  function renderTinderCard() {
    const card = document.getElementById("tinder-card");
    if (tinderIndex >= places.length) return card.textContent = "Больше мест нет";
    const place = places[tinderIndex];
    card.innerHTML = `<h3>${place.name}</h3><img src="${place.image}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;"><p>${place.description}</p>`;
  }

  document.getElementById("skip").onclick = () => {
    tinderIndex++;
    renderTinderCard();
  };

  document.getElementById("go").onclick = () => {
    if (!places[tinderIndex]) return;
    route = [places[tinderIndex]];
    currentStep = 0;
    stage = "map";
    sections.tinder.style.display = "none";
    sections.route.style.display = "block";
    resetNav();
    navButtons.route.classList.add("active");
    const start = document.getElementById("startInput").value.trim() || "Советская площадь";
    geocode(start)
      .then(startCoords => renderRouteFromTo(startCoords, route[0].coordinates))
      .then(() => showStep())
      .catch(() => {
        renderRouteFromTo([57.6261, 39.8845], route[0].coordinates);
        showStep();
      });
  };

  function showStep() {
    const place = route[currentStep];
    if (stage === "map") {
      sections.placeInfo.style.display = "none";
      sections.route.style.display = "block";
      document.getElementById("route-progress").innerHTML = `<h2>${place.name}</h2>`;
      showButton("i-am-here", "Я тут", () => {
        stage = "info";
        showStep();
      });
    } else {
      sections.route.style.display = "none";
      sections.placeInfo.style.display = "block";
      document.getElementById("place-img").src = place.image;
      document.getElementById("place-name").textContent = place.name;
      document.getElementById("place-desc").textContent = place.description;
      document.getElementById("audio-btn").onclick = () => alert("Аудиогид скоро");
      const nextBtn = document.getElementById("next-place");
      nextBtn.onclick = () => {
        currentStep++;
        if (currentStep >= route.length) return finishRoute();
        stage = "map";
        const prev = route[currentStep - 1];
        const next = route[currentStep];
        renderRouteFromTo(prev.coordinates, next.coordinates);
        showStep();
      };
    }
  }

  function finishRoute() {
    alert("🎉 Маршрут завершён!");
    route = [];
    currentStep = 0;
    stage = "map";
    sections.placeInfo.style.display = "none";
    sections.route.style.display = "none";
    sections.main.style.display = "block";
    resetNav();
    navButtons.route.classList.remove("active");
    selectedTags.clear();
    renderCategoryMenu();
  }

  function renderCategoryMenu() {
    const container = document.getElementById("categories");
    container.innerHTML = "";
    for (let [group, tags] of Object.entries(categoryData)) {
      const groupDiv = document.createElement("div");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "category-toggle";
      toggle.textContent = group;
      const tagWrap = document.createElement("div");
      tagWrap.className = "tag-container";
      tagWrap.style.display = "none";

      toggle.onclick = () => {
        tagWrap.style.display = tagWrap.style.display === "none" ? "grid" : "none";
      };

      for (let [tag, label] of Object.entries(tags)) {
        const el = document.createElement("div");
        el.className = "activity-circle";
        el.dataset.tag = tag;
        el.textContent = label;
        el.onclick = () => {
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
            el.classList.remove("selected");
          } else {
            selectedTags.add(tag);
            el.classList.add("selected");
          }
        };
        tagWrap.appendChild(el);
      }
      groupDiv.appendChild(toggle);
      groupDiv.appendChild(tagWrap);
      container.appendChild(groupDiv);
    }
  }

  function showButton(id, text, onClick) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.style.marginTop = "10px";
      document.getElementById("route-progress").appendChild(btn);
    }
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.display = "inline-block";
  }
});