import {ARApp} from "../src/ARApp";

const app = new ARApp();
app.initialize();

const gui = new GUI(app);
gui.create();

