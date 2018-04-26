import {AfterViewInit, Component, Inject} from "@angular/core";
import {Modal, ModalController, Refresher} from "ionic-angular";
import {TranslateService} from "ng2-translate/src/translate.service";
import {ILIASObjectAction} from "../../actions/object-action";
import {OPEN_OBJECT_IN_ILIAS_ACTION_FACTORY, OpenObjectInILIASAction} from "../../actions/open-object-in-ilias-action";
import {ILIASObject} from "../../models/ilias-object";
import {User} from "../../models/user";
import {ILIASObjectPresenter} from "../../presenters/object-presenter";
import {Builder} from "../../services/builder.base";
import {FooterToolbarService, Job} from "../../services/footer-toolbar.service";
import {LINK_BUILDER, LinkBuilder} from "../../services/link/link-builder.service";
import {Logger} from "../../services/logging/logging.api";
import {Logging} from "../../services/logging/logging.service";
import {NEWS_FEED, NewsFeed, NewsItemModel} from "../../services/news/news.feed";
import {SynchronizationService, SyncResults} from "../../services/synchronization.service";
import {SyncFinishedModal} from "../sync-finished-modal/sync-finished-modal";

/**
 * Generated class for the NewsComponent component.
 *
 * See https://angular.io/api/core/Component for more info on Angular
 * Components.
 */
@Component({
    selector: "newsPresenters",
    templateUrl: "news.html"
})
export class NewsPage implements AfterViewInit {

    newsPresenters: Array<[NewsItemModel, ILIASObjectPresenter]>;
    private readonly log: Logger = Logging.getLogger(NewsPage.name);


    constructor(
        @Inject(NEWS_FEED) private readonly newsFeed: NewsFeed,
        private readonly translate: TranslateService,
        private readonly sync: SynchronizationService,
        private readonly footerToolbar: FooterToolbarService,
        private readonly modal: ModalController,
        @Inject(OPEN_OBJECT_IN_ILIAS_ACTION_FACTORY)
        private readonly openInIliasActionFactory: (title: string, urlBuilder: Builder<Promise<string>>) => OpenObjectInILIASAction,
        @Inject(LINK_BUILDER) private readonly linkBuilder: LinkBuilder
    ) {}


    ngAfterViewInit(): void {
        this.log.debug(() => "News view initialized.");
        this.fetchPresenterNewsTuples().then(
            (newsPresenterItems: Array<[NewsItemModel, ILIASObjectPresenter]>) => {this.newsPresenters = newsPresenterItems});
    }

    openNews(id: number, context: number): void {
        this.log.debug(() => `open news with id ${id}, context id ${context}`);
        const action: ILIASObjectAction = this.openInIliasActionFactory(
            this.translate.instant("actions.view_in_ilias"),
            this.linkBuilder.news().newsId(id).context(context)
        );

        this.executeAction(action);
    }

    /**
     * called by pull-to-refresh refresher
     *
     * @param {Refresher} refresher
     * @returns {Promise<void>}
     */
    async startSync(refresher: Refresher): Promise<void> {
        await this.executeSync();
        refresher.complete();
    }

    // ------------------- object-list duplicate----------------------------
    private executeAction(action: ILIASObjectAction): void {
        const hash: number = action.instanceId();
        this.footerToolbar.addJob(hash, "");
        action.execute().then(() => {
            this.footerToolbar.removeJob(hash);
        }).catch((error) => {
            this.log.error(() => `action failed with message: ${error}`);
            this.footerToolbar.removeJob(hash);
            throw error;
        });
    }

    /**
     * executes global sync
     *
     * @returns {Promise<void>}
     */
    private async executeSync(): Promise<void> {

        try {

            if (this.sync.isRunning) {
                this.log.debug(() => "Sync is already running.");
                return;
            }

            this.log.info(() => "Sync start");
            this.footerToolbar.addJob(Job.Synchronize, this.translate.instant("synchronisation_in_progress"));

            const syncResult: SyncResults = await this.sync.execute();

            // We have some files that were marked but not downloaded. We need to explain why and open a modal.
            if (syncResult.objectsLeftOut.length > 0) {
                const syncModal: Modal = this.modal.create(SyncFinishedModal, {syncResult: syncResult});
                await syncModal.present();
            }

            //maybe some objects came in new.
            this.footerToolbar.removeJob(Job.Synchronize);

        } catch (error) {

            this.log.error(() => `Error occured in sync implemented in news page. Error: ${error}`);
            this.footerToolbar.removeJob(Job.Synchronize);

            throw error;
        }
    }

    private async fetchPresenterByRefId(refId: number): Promise<ILIASObjectPresenter> {
        const userId: number = (await User.currentUser()).id;
        return (await ILIASObject.findByRefId(refId, userId)).presenter;
    }

    private async fetchPresenterNewsTuples(): Promise<Array<[NewsItemModel, ILIASObjectPresenter]>> {
        const news: Array<NewsItemModel> = await this.newsFeed.fetchAllForCurrentUser();
        const mappedNews: Array<[NewsItemModel, ILIASObjectPresenter]> = [];
        for(const newsItem of news) {
            mappedNews.push([newsItem, await this.fetchPresenterByRefId(newsItem.newsContext)])
        }
        mappedNews.sort((a: [NewsItemModel, ILIASObjectPresenter], b: [NewsItemModel, ILIASObjectPresenter]): number => {
            return b[0].updateDate.getTime() - a[0].updateDate.getTime();
        });
        return mappedNews;
    }
}
