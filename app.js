let places = [];
let selectedTags = new Set();
let route = [];
let currentStep = 0;
let stage = "map"; // "map" или "info"
let mapInstance = null;
let tinderIndex = 0;
let currentPositionCoords = null; // храним текущие координаты для маршрута

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

// Получить координаты по названию через Яндекс Геокодер
function geocode(placeName) {
  return ymaps.geocode(placeName).then(res => {
    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) throw new Error('Место не найдено');
    return firstGeoObject.geometry.getCoordinates(); // [lat, lon]
  });
}

// Инициализировать карту и построить маршрут
function initMapAndRoute(startCoords, endCoords) {
  if (mapInstance) mapInstance.destroy();

  mapInstance = new ymaps.Map("map", {
    center: startCoords,
    zoom: 14,
    controls: ['zoomControl', 'fullscreenControl']
  });

  const startPlacemark = new ymaps.Placemark(startCoords, {
    balloonContent: 'Вы здесь'
  }, {
    preset: 'islands#blueCircleIcon'
  });

  const endPlacemark = new ymaps.Placemark(endCoords, {
    balloonContent: 'Место назначения'
  }, {
    preset: 'islands#redCircleIcon'
  });

  mapInstance.geoObjects.add(startPlacemark);
  mapInstance.geoObjects.add(endPlacemark);

  ymaps.route([startCoords, endCoords], {
    routingMode: 'pedestrian'
  }).then(route => {
    mapInstance.geoObjects.add(route);
    // Правильно берём bounds у маршрута
    const bounds = route.getWayPoints().getBounds() || route.getPaths().getBounds();
    if (bounds) {
      mapInstance.setBounds(bounds, { checkZoomRange: true });
    }
  }).catch(err => {
    alert('Не удалось построить маршрут: ' + err.message);
  });
}

window.addEventListener("load", () => {
  const navButtons = {
    route: document.getElementById("nav-route"),
    promos: document.getElementById("nav-promos"),
    tinder: document.getElementById("nav-tinder"),
  };

  const sections = {
    main: document.getElementById("main-section"),
    route: document.getElementById("route-display"),
    promos: document.getElementById("promos"),
    tinder: document.getElementById("tinder-section"),
    placeInfo: document.getElementById("place-info"),
  };

  function resetNavigation() {
    Object.values(navButtons).forEach(b => b.classList.remove("active"));
  }

  Object.entries(navButtons).forEach(([key, btn]) => {
    btn.addEventListener("click", () => {
      Object.values(sections).forEach(s => s.style.display = "none");
      resetNavigation();
      btn.classList.add("active");

      if (key === "route") {
        if (route.length === 0) {
          // Нет маршрута — показываем главный экран с категориями
          sections.main.style.display = "block";
          resetNavigation();
          navButtons.route.classList.remove("active");
          return;
        }
      }

      sections[key].style.display = "block";

      if (key === "tinder") {
        renderTinderCard();
        document.getElementById("tinder-card").style.display = "block";
        document.querySelector(".tinder-buttons").style.display = "flex";
        document.getElementById("back-to-main").style.display = "inline-block";
      }
    });
  });

  renderCategoryMenu();

  fetch("./places.json")
    .then(res => {
      if (!res.ok) throw new Error("Ошибка загрузки places.json");
      return res.json();
    })
    .then(data => {
      places = data;
      renderTinderCard();
    })
    .catch(err => {
      console.error(err);
      alert("Не удалось загрузить места");
      document.getElementById("tinder-card").textContent = "Места не загружены.";
    });

  document.getElementById("show-route").addEventListener("click", () => {
    if (selectedTags.size === 0) {
      alert("Пожалуйста, выберите хотя бы одну категорию.");
      return;
    }
    const ageFilter = document.getElementById("age").value;
    const duration = parseInt(document.getElementById("duration").value);
    const maxPlaces = duration * 2;
    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";

    route = places.filter(p =>
      p.tags.some(tag => selectedTags.has(tag)) &&
      (ageFilter === "all" || p.age === ageFilter || p.age === "all")
    ).slice(0, maxPlaces);

    if (route.length === 0) {
      alert("По выбранным категориям нет подходящих мест.");
      return;
    }

    currentStep = 0;
    stage = "map";

    sections.main.style.display = "none";
    sections.route.style.display = "block";
    resetNavigation();
    navButtons.route.classList.add("active");

    geocode(startPoint)
      .then(startCoords => {
        currentPositionCoords = startCoords; // сохраняем старт
        initMapAndRoute(startCoords, route[currentStep].coordinates);
        showStep();
      })
      .catch(() => {
        alert("Не удалось определить начальную точку. Используем Советскую площадь.");
        currentPositionCoords = [57.6261, 39.8845];
        initMapAndRoute(currentPositionCoords, route[currentStep].coordinates);
        showStep();
      });
  });

  document.getElementById("back-from-place-info").addEventListener("click", () => {
    sections.placeInfo.style.display = "none";
    sections.route.style.display = "block";
  });

  document.getElementById("back-to-main").addEventListener("click", () => {
    sections.tinder.style.display = "none";
    sections.main.style.display = "block";
    resetNavigation();
    navButtons.route.classList.add("active");
  });

  function renderTinderCard() {
    const card = document.getElementById("tinder-card");
    if (!places.length) {
      card.textContent = "Места не загружены.";
      return;
    }
    if (tinderIndex >= places.length) {
      card.textContent = "Больше мест нет.";
      return;
    }
    const place = places[tinderIndex];
    card.innerHTML = `
      <h3>${place.name}</h3>
      <img src="${place.image}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;" />
      <p>${place.description}</p>
    `;
  }

  document.getElementById("skip").addEventListener("click", () => {
    tinderIndex++;
    renderTinderCard();
  });

  document.getElementById("go").addEventListener("click", () => {
    if (!places.length || tinderIndex >= places.length) return;

    route = [places[tinderIndex]];
    currentStep = 0;
    stage = "map";

    sections.tinder.style.display = "none";
    sections.route.style.display = "block";

    resetNavigation();
    navButtons.route.classList.add("active");

    const startPoint = document.getElementById("startInput").value.trim() || "Советская площадь";

    geocode(startPoint)
      .then(startCoords => {
        currentPositionCoords = startCoords;
        initMapAndRoute(startCoords, route[0].coordinates);
        showStep();
      })
      .catch(() => {
        alert("Не удалось определить начальную точку. Используем Советскую площадь.");
        currentPositionCoords = [57.6261, 39.8845];
        initMapAndRoute(currentPositionCoords, route[0].coordinates);
        showStep();
      });
  });

  function showStep() {
    const routeSection = document.getElementById("route-display");
    const infoSection = document.getElementById("place-info");
    const place = route[currentStep];

    if (stage === "map") {
      infoSection.style.display = "none";
      routeSection.style.display = "block";

      document.getElementById("route-progress").innerHTML = `<h2>${place.name}</h2>`;
      showButton("i-am-here", "Я тут", () => {
        stage = "info";
        showStep();
      });
    } else if (stage === "info") {
      routeSection.style.display = "none";
      infoSection.style.display = "block";

      document.getElementById("place-img").src = place.image;
      document.getElementById("place-name").textContent = place.name;
      document.getElementById("place-desc").textContent = place.description;

      document.getElementById("audio-btn").onclick = () => alert("Аудиогид скоро будет доступен.");

      const nextBtn = document.getElementById("next-place");
      nextBtn.style.display = "inline-block";
      nextBtn.onclick = () => {
        currentStep++;
        if (currentStep >= route.length) {
          finishRoute();
          return;
        }
        stage = "map";

        const prevPlace = route[currentStep - 1];
        const nextPlace = route[currentStep];

        // Строим маршрут от текущей позиции к следующему месту
        const startCoords = currentPositionCoords || prevPlace.coordinates;
        currentPositionCoords = nextPlace.coordinates;

        initMapAndRoute(startCoords, nextPlace.coordinates);
        showStep();
      };
    }
  }

  function showButton(id, text, onClick) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.style.marginTop = "10px";
      const container = document.getElementById("route-progress");
      container.appendChild(btn);
    }
    btn.textContent = text;
    btn.onclick = onClick;
    btn.style.display = "inline-block";
  }

  function finishRoute() {
    alert("🎉 Поздравляем! Маршрут завершён.");

    route = [];
    currentStep = 0;
    stage = "map";
    currentPositionCoords = null;

    sections.placeInfo.style.display = "none";
    sections.route.style.display = "none";
    sections.main.style.display = "block";

    resetNavigation();
    navButtons.route.classList.remove("active");

    selectedTags.clear();
    renderCategoryMenu();
  }

  function renderCategoryMenu() {
    const container = document.getElementById("categories");
    container.innerHTML = "";
    for (let [groupName, tags] of Object.entries(categoryData)) {
      const groupDiv = document.createElement("div");
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "category-toggle";
      toggleBtn.textContent = groupName;

      const tagWrap = document.createElement("div");
      tagWrap.className = "tag-container";
      tagWrap.style.display = "none";

      toggleBtn.onclick = () => {
        tagWrap.style.display = tagWrap.style.display === "none" ? "grid" : "none";
      };

      for (let [tag, label] of Object.entries(tags)) {
        const tagEl = document.createElement("div");
        tagEl.className = "activity-circle";
        tagEl.dataset.tag = tag;
        tagEl.textContent = label;

        tagEl.onclick = () => {
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
            tagEl.classList.remove("selected");
          } else {
            selectedTags.add(tag);
            tagEl.classList.add("selected");
          }
        };

        tagWrap.appendChild(tagEl);
      }

      groupDiv.appendChild(toggleBtn);
      groupDiv.appendChild(tagWrap);
      container.appendChild(groupDiv);
    }
  }
});
