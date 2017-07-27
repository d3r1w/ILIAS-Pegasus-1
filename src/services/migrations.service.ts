import {Injectable} from '@angular/core';
import {CreateModelsMigration} from "../migrations/1-create-models-migration";
import {Migration} from "../migrations/migration";
import {SQLiteDatabaseService} from "./database.service";
import {Log} from "./log.service";

@Injectable()
export class MigrationsService {

    protected migrations:Array<{id:number, migration:Migration}>;

    constructor() {
        this.migrations = [
            {id: 1, migration: new CreateModelsMigration()}
        ];
    }

    /**
     * Execute all pending migrations
     */
    public executeAll():Promise<any> {
        var migrations = [];
        Log.describe(this, "Migrations: ", this.migrations);

        return this.init().then(() => {
            Log.write(this, "migrations table initialized.");

            this.migrations.forEach(migration => {
                migrations.push(this.execute(migration.id));
            });

            return Promise.all(migrations);
        });
    }

    /**
     * Reverse migration with given ID
     * @param id
     */
    public reverse(id:number):Promise<any> {
        return new Promise((resolve, reject) => {
            let migration = this.getMigration(id);
            migration.down().then(() => {
                SQLiteDatabaseService.instance().then( db => {
                    db.query('DELETE FROM migrations WHERE id = ?', [id]).then(() => {
                        console.log('Reversed migration ' + id);
                        resolve();
                    }, () => {
                        reject();
                    });
                });
            });
        });
    }

    protected init() {
        return SQLiteDatabaseService.instance()
            .then(db => { db.query('CREATE TABLE IF NOT EXISTS migrations (id INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)'); })
            .then(() => {
                Log.write(this, "init migrations table finished.");
                return Promise.resolve();
            });
    }

    /**
     * Execute migration with given ID if not yet executed
     * @param id
     */
    protected execute(id:number):Promise<any> {
        return new Promise((resolve, reject) => {
            SQLiteDatabaseService.instance().then( db => {
                Log.write(this, "got db instance.");
                db.query('SELECT * FROM migrations WHERE id = ?', [id]).then((response) => {
                    Log.describe(this, "found migrations: ", response);
                    // Only execute the migration if not executed before!
                    if (response.rows.length > 0) {
                        resolve();
                    } else {
                        let migration = this.getMigration(id);
                        Log.write(this, "Migrate UP!");
                        migration.up().then(() => {
                            SQLiteDatabaseService.instance().then(db => {
                                db.query('INSERT INTO migrations (id) VALUES (?)', [id]).then(() => {
                                    resolve();
                                }, (error) => {
                                    reject(error);
                                });
                            }, (error) => {
                                reject(error);
                            });
                        });
                    }
                }, (error) => {
                    Log.error(this, error);
                    reject(error);
                });
            });
        });
    }

    /**
     * Return migration with given ID
     * @param id
     * @returns {Migration}
     */
    protected getMigration(id:number):Migration {
        return this.migrations.filter(function (migration) {
            return migration.id == id;
        })[0].migration;
    }

}