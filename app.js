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

function geocode(placeName) {
  return ymaps.geocode(placeName).then(res => {
    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) throw new Error('Место не найдено');
    return firstGeoObject.geometry.getCoordinates();
  });
}

function distanceBetweenCoords(coord1, coord2) {
  const R = 6371e3;
  const lat1 = coord1[0] * Math.PI / 180;
  const lat2 = coord2[0] * Math.PI / 180;
  const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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
    if (typeof route.getBounds === 'function') {
      mapInstance.setBounds(route.getBounds(), { checkZoomRange: true });
    }
  }).catch(err => {
    alert('Не удалось построить маршрут: ' + err.message);
  });
}

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

function finishRoute() {
  const statsSection = document.getElementById("route-stats");
  const infoSection = document.getElementById("place-info");
  const routeSection = document.getElementById("route-display");

  const timeSpentMs = Date.now() - routeStartTime;
  const minutesSpent = Math.floor(timeSpentMs / 60000);

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

  statsSection.innerHTML = `
    <h2>Статистика прогулки</h2>
    <p>Посещено мест: <b>${route.length}</b></p>
    <p>Общая длина маршрута: <b>${(routeLengthMeters / 1000).toFixed(2)} км</b></p>
    <p>Прогулка заняла: <b>${minutesSpent} минут</b></p>
    <p>Пройдено шагов (примерно): <b>${Math.round((routeLengthMeters / 1000) * 1300)}</b></p>
    <button id="start-new-route">Начать новый маршрут</button>
  `;

  document.getElementById("start-new-route").onclick = () => {
    statsSection.style.display = "none";
    document.getElementById("main-section").style.display = "block";
    selectedTags.clear();
    renderCategoryMenu();
  };

  route = [];
  currentStep = 0;
  routeStartTime = null;
  routeLengthMeters = 0;
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
