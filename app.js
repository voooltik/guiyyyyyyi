let places = [];
let selectedTags = new Set();
let route = [];
let currentStep = 0;
let stage = "map"; // "map" или "info"
let mapInstance = null;
let tinderIndex = 0;
let routeStartTime = null;  // Для таймера
let routeLengthMeters = 0;  // Для подсчёта длины маршрута

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

const DEFAULT_START = [57.6261, 39.8845]; // Советская площадь

// Геокодируем название места в координаты через Яндекс API
function geocode(placeName) {
  return ymaps.geocode(placeName).then(res => {
    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) throw new Error('Место не найдено');
    return firstGeoObject.geometry.getCoordinates(); // [lat, lon]
  });
}

// Функция для вычисления расстояния между двумя координатами в метрах (Haversine formula)
function distanceBetweenCoords(coord1, coord2) {
  const R = 6371e3; // Радиус Земли в метрах
  const lat1 = coord1[0] * Math.PI / 180;
  const lat2 = coord2[0] * Math.PI / 180;
  const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // в метрах
}

// Отрисовка маршрута между двумя координатами на Яндекс карте
function renderRouteFromTo(startCoords, endCoords) {
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
    mapInstance.setBounds(route.getBounds(), { checkZoomRange: true });
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
    stats: document.getElementById("route-stats") // Добавим новый блок статистики (нужно создать в HTML)
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
          // Если нет маршрута — показываем главный экран с категориями
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
    routeLengthMeters = 0;    // Сброс длины
    routeStartTime = Date.now(); // Запуск таймера

    sections.main.style.display = "none";
    sections.route.style.display = "block";
    sections.stats.style.display = "none";  // Скрываем статистику при старте нового маршрута
    resetNavigation();
    navButtons.route.classList.add("active");

    const startPointName = document.getElementById("startInput").value.trim() || "Советская площадь";
    geocode(startPointName)
      .then(startCoords => {
        renderRouteFromTo(startCoords, route[currentStep].coordinates);
        showStep();
      })
      .catch(() => {
        renderRouteFromTo(DEFAULT_START, route[currentStep].coordinates);
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
    card.innerHTML = 
      <h3>${place.name}</h3>
      <img src="${place.image}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;" />
      <p>${place.description}</p>
    ;
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
    routeLengthMeters = 0;
    routeStartTime = Date.now();

    sections.tinder.style.display = "none";
    sections.route.style.display = "block";
    sections.stats.style.display = "none";

    resetNavigation();
    navButtons.route.classList.add("active");

    const startPointName = document.getElementById("startInput").value.trim() || "Советская площадь";

    geocode(startPointName)
      .then(startCoords => {
        renderRouteFromTo(startCoords, route[0].coordinates);
        showStep();
      })
      .catch(() => {
        renderRouteFromTo(DEFAULT_START, route[0].coordinates);
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

      document.getElementById("route-progress").innerHTML = <h2>${place.name}</h2>;
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
        // Подсчёт расстояния между предыдущей и текущей точками и добавление к общей длине маршрута
        const prevPlace = route[currentStep];
        currentStep++;

        if (currentStep >= route.length) {
          finishRoute();
          return;
        }

        const nextPlace = route[currentStep];
        routeLengthMeters += distanceBetweenCoords(prevPlace.coordinates, nextPlace.coordinates);

        stage = "map";
        renderRouteFromTo(prevPlace.coordinates, nextPlace.coordinates);
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

  // Новый блок для показа статистики после маршрута
  function finishRoute() {
    const statsSection = document.getElementById("route-stats");
    const infoSection = document.getElementById("place-info");
    const routeSection = document.getElementById("route-display");

    const timeSpentMs = Date.now() - routeStartTime;
    const minutesSpent = Math.floor(timeSpentMs / 60000);

    // Подсчёт финального расстояния между последними точками (если не был подсчитан)
    if (route.length > 1 && currentStep === route.length) {
      let distSum = 0;
      for (let i = 0; i < route.length - 1; i++) {
        distSum += distanceBetweenCoords(route[i].coordinates, route[i + 1].coordinates);
      }
      routeLengthMeters = distSum;
    }

    infoSection.style.display = "none";
    routeSection.style.display = "none";
    statsSection.style.display = "block";

    statsSection.innerHTML = 
      <h2>Статистика прогулки</h2>
      <p>Посещено мест: <b>${route.length}</b></p>
      <p>Общая длина маршрута: <b>${(routeLengthMeters / 1000).toFixed(2)} км</b></p>
      <p>Прогулка заняла: <b>${minutesSpent} минут</b></p>
      <p>Пройдено шагов (примерно): <b>${Math.round((routeLengthMeters / 1000) * 1300)}</b></p>
      <button id="start-new-route">Начать новый маршрут</button>
    ;

    document.getElementById("start-new-route").onclick = () => {
      statsSection.style.display = "none";
      sections.main.style.display = "block";
      resetNavigation();
      navButtons.route.classList.remove("active");
      selectedTags.clear();
      renderCategoryMenu();
    };

    route = [];
    currentStep = 0;
    routeStartTime = null;
    routeLengthMeters = 0;
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
