import EventComponent from "../components/event";
import TripFormComponent from "../components/edit-form";
import Event from "../models/event";
import {render, replace, remove} from "../utils/render";
import {RenderPosition} from "../utils/render";
import {ProcessingButtonData, DefaultButtonData, EventKey} from "../const";
import {switchFormAvailability} from "../utils/common";
import flatpickr from "flatpickr";

const SHAKE_ANIMATION_TIMEOUT = 600;
const SHAKE_STYLE = `box-shadow: 0px 0px 15px 0px rgba(245,32,32,1);`;

export const Mode = {
  ADDING: `adding`,
  DEFAULT: `default`,
  EDIT: `edit`,
};


export const EmptyEvent = {
  startDate: flatpickr.parseDate(new Date(), `d/m/y H:i`),
  endDate: flatpickr.parseDate(new Date(), `d/m/y H:i`),
  type: `bus`,
  destination: {
    name: ``,
    description: [],
    photo: []
  },
  price: 0,
  offers: [],
  isFavorite: false
};

const parseFormData = (formData, allOffers, allDestinations) => {
  const type = formData.get(`event-type`);
  const startDate = flatpickr.parseDate(formData.get(`event-start-time`), `d/m/y H:i`);
  const endDate = flatpickr.parseDate(formData.get(`event-end-time`), `d/m/y H:i`);

  const typeOffersNew = allOffers.find((it) => it.type.toString() === type).offers;
  const offersFromForm = formData.getAll(`event-offer`);
  const checkedOffers = typeOffersNew.filter((offer) => offersFromForm.some((formOffer) => offer.title === formOffer));

  const city = formData.get(`event-destination`);
  const checkedDestination = allDestinations.find((it)=> it.name === city);

  return new Event({
    "type": type,
    "destination": checkedDestination,
    "base_price": Math.abs(Number(formData.get(`event-price`))),
    "date_from": startDate,
    "date_to": endDate,
    "offers": checkedOffers,
    "is_favorite": Boolean(formData.get(`event-favorite`))
  });
};

export default class EventController {
  constructor(container, onDataChange, onViewChange, points, types) {
    this._container = container;
    this._onDataChange = onDataChange;
    this._onViewChange = onViewChange;
    this._points = points;
    this._types = types;
    this._mode = Mode.DEFAULT;
    this._createButton = document.querySelector(`.trip-main__event-add-btn`);

    this._eventComponent = null;
    this._eventEditComponent = null;

    this._onEscKeyDown = this._onEscKeyDown.bind(this);
  }

  render(event, mode) {
    const oldEventComponent = this._eventComponent;
    const oldEventEditComponent = this._eventEditComponent;
    this._mode = mode;
    this._eventComponent = new EventComponent(event);
    this._eventEditComponent = new TripFormComponent(event, this._points, this._types, this._mode);

    this._eventComponent.setArrowHandler(() => {
      this._replaceEventToEdit();
      this._eventEditComponent.reset();
      document.addEventListener(`keydown`, this._onEscKeyDown);
    });

    this._eventEditComponent.setArrowHandler(() => {
      if (this._mode !== Mode.ADDING) {
        this._replaceEditToEvent();
        document.removeEventListener(`keydown`, this._onEscKeyDown);
      } else {
        this._onDataChange(EmptyEvent, null);
        document.removeEventListener(`keydown`, this._onEscKeyDown);
      }
    });

    this._eventEditComponent.setFavoritesButtonClickHandler((isFavorite) => {
      const data = Event.clone(event);
      data.isFavorite = isFavorite;
      this._onDataChange(event, data, true);
    });

    this._eventEditComponent.setSubmitHandler((evt, id) => {
      evt.preventDefault();
      const formData = this._eventEditComponent.getData();
      const data = parseFormData(formData, this._types, this._points);
      data.id = id || new Date().valueOf().toString();
      this._eventEditComponent.setData({
        SAVE_BUTTON_TEXT: ProcessingButtonData.SAVE_BUTTON_TEXT
      });
      switchFormAvailability(this._eventEditComponent.getElement(), true);
      this._eventEditComponent.removeFlatpickr();
      this._onDataChange(event, data);
    });

    this._eventEditComponent.setDeleteButtonClickHandler(() => {
      if (this._mode !== Mode.ADDING) {
        this._eventEditComponent.setData({
          DELETE_BUTTON_TEXT: ProcessingButtonData.DELETE_BUTTON_TEXT,
        });
        switchFormAvailability(this._eventEditComponent.getElement(), true);
        this._onDataChange(event, null);
      } else {
        this._createButton.disabled = false;
        this._onDataChange(EmptyEvent, null);
      }
    });

    switch (mode) {
      case Mode.DEFAULT:
        this._eventEditComponent.removeFlatpickr();
        this._createButton.disabled = false;
        if (oldEventEditComponent && oldEventComponent) {
          replace(this._eventComponent, oldEventComponent);
          replace(this._eventEditComponent, oldEventEditComponent);
          this._replaceEditToEvent();
        } else {
          render(this._container, this._eventComponent);
        }
        break;
      case Mode.ADDING:
        this._createButton.disabled = true;
        if (oldEventEditComponent && oldEventComponent) {
          remove(oldEventComponent);
          remove(oldEventEditComponent);
        }
        document.addEventListener(`keydown`, this._onEscKeyDown);
        render(this._container, this._eventEditComponent, RenderPosition.AFTERBEGIN);
        break;
    }

  }

  setDefaultView() {
    if (this._mode === Mode.EDIT) {
      this._replaceEditToEvent();
    } else {
      remove(this._eventEditComponent);
    }
  }

  destroy() {
    remove(this._eventEditComponent);
    remove(this._eventComponent);
    document.removeEventListener(`keydown`, this._onEscKeyDown);
  }

  shake() {
    this._eventEditComponent.getElement().style = SHAKE_STYLE;
    this._eventEditComponent.getElement().style.animation = `shake ${SHAKE_ANIMATION_TIMEOUT / 1000}s`;
    setTimeout(() => {
      this._eventEditComponent.getElement().style = ``;
      this._eventEditComponent.getElement().style.animation = ``;
      this._eventEditComponent.setData(DefaultButtonData);
    }, SHAKE_ANIMATION_TIMEOUT);
  }

  _replaceEditToEvent() {
    this._eventEditComponent.reset();
    this._eventEditComponent.removeFlatpickr();

    if (document.contains(this._eventEditComponent.getElement())) {
      replace(this._eventComponent, this._eventEditComponent);
    }

    this._mode = Mode.DEFAULT;
  }

  _replaceEventToEdit() {
    this._onViewChange();
    replace(this._eventEditComponent, this._eventComponent);
    this._mode = Mode.EDIT;
    this._createButton.disabled = false;
  }

  _onEscKeyDown(evt) {
    const isEscKey = evt.key === EventKey.ENTER_KEY || evt.key === EventKey.ESC_KEY;

    if (isEscKey) {
      this._createButton.disabled = false;
      if (this._mode === Mode.ADDING) {
        this._onDataChange(EmptyEvent, null);
      }

      this._replaceEditToEvent();
      document.removeEventListener(`keydown`, this._onEscKeyDown);
    }
  }
}
