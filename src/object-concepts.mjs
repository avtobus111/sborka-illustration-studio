// Descriptions belong to library objects, not to accepted user queries.
export const objectConcepts=[
 {id:'book',reason:'знания, обучение и чтение',texts:['Обучение и изучение нового. Учебный материал, образование, знания и самообразование.','Чтение книг, литературы и учебников. Книга как источник знаний.','Читальный зал, библиотека и литературный вечер.']},
 {id:'phone',reason:'цифровой инструмент и связь',texts:['Мобильные устройства и цифровые сервисы. Онлайн-приложения, электронные инструменты, интернет.','Удалённая связь: звонки, видеозвонки, диалог и общение.']},
 {id:'puzzle',reason:'сотрудничество и соединение частей',texts:['Объединение усилий и сотрудничество. Совместное решение задач, команда и вклад каждого.','Составить целое из частей. Связать идеи, решить проблему и головоломку.']},
 {id:'wallet',reason:'расходы, покупки и личный бюджет',texts:['Личный бюджет и покупки. Расходы, платежи, хранение денег и сбережения.','Бережливость, контролировать траты, оплатить покупку.','Деньги, банковские услуги, банковский счёт и личные финансы.']},
 {id:'coin',reason:'деньги и накопления',texts:['Деньги, заработок, накопления, капитал, платежи и стоимость.','Откладывать небольшие суммы для финансовой цели.','Копить, сберегать и накапливать. Финансовая цель и накопительный банковский счёт.']},
 {id:'headphones',reason:'аудио или сосредоточенность',texts:['Слушать аудио: музыка, подкасты, записи голоса и звучание.','Уединение, тишина, сосредоточенность, убрать шум и отвлечения.','Любитель музыки. Меломан, песни, мелодии и музыкальная коллекция.']},
 {id:'lamp',reason:'вечерняя работа или новая идея',texts:['Работать вечером: освещение рабочего стола, свет и уют.','Идея и озарение, вдохновение, творческий поиск.']},
 {id:'flowers',reason:'поздравление, подарок и забота',texts:['Подарок и поздравление. Поблагодарить, порадовать другого, праздник, букет и забота.']},
 {id:'folder',reason:'хранение материалов и порядок',texts:['Документы и хранение. Собрать бумаги, записи, чеки, архив и отчёты.','Организация задач и порядок в делах. Систематизация материалов.','Хранение чеков, квитанций и бумаг.']},
 {id:'pen',reason:'запись информации и планирование',texts:['Записать мысль или информацию. Заметки, конспекты, письма и письменные поздравления.','Планирование: заранее обдумать последовательность действий, записать план, расписание и цели.']}
];

export const intentAnchors={communication:['phone','puzzle'],savings:['wallet','coin'],budget:['wallet','coin'],teamwork:['puzzle'],learning:['book'],focus:['headphones'],organization:['folder'],planning:['pen'],music:['headphones'],care:['flowers'],ideas:['lamp'],digital:['phone']};

// Coherence metadata limits incidental associations in a single-intent query.
// Strong evidence from another clause may still introduce a different domain.
export const objectContexts={
 book:['learning','focus','planning','ideas','teamwork','organization'],
 phone:['communication','digital','teamwork','budget','savings','music','organization','learning','care','planning'],
 puzzle:['teamwork','communication','ideas','learning','digital','planning'],
 wallet:['savings','budget','planning','digital','organization'],
 coin:['savings','budget','planning','digital'],
 headphones:['music','focus','learning','care','digital'],
 lamp:['learning','focus','planning','ideas'],
 flowers:['care','music'],
 folder:['organization','planning','budget','savings','digital','teamwork'],
 pen:['planning','learning','teamwork','care','communication','ideas','budget','savings','organization']
};
