import {Component} from "@angular/core";
import {NavController} from "ionic-angular";
import {InAppBrowser} from "@ionic-native/in-app-browser";

/*
  Generated class for the InfoPage page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  templateUrl: "info.html"
})
export class InfoPage {

  tab: string = "info";

  constructor(
    public nav: NavController,
    private readonly browser: InAppBrowser
  ) {}

  call(number) {
    (<any> window).location = number;
  }

  browse(page) {
    this.browser.create(page, "_system");
  }
}
