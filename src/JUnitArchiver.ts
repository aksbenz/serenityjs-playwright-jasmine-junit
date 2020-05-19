import { ensure, isGreaterThan, property, match } from 'tiny-types';
import {
    ActivityRelatedArtifactArchived,
    ActivityRelatedArtifactGenerated,
    ArtifactArchived,
    ArtifactGenerated,
    AsyncOperationAttempted,
    AsyncOperationCompleted,
    AsyncOperationFailed,
    DomainEvent,
} from '@serenity-js/core/lib/events';
import { FileSystem, Path } from '@serenity-js/core/lib/io';
import { Artifact, ArtifactType, CorrelationId, Description, Name } from '@serenity-js/core/lib/model';
import { Stage, StageCrewMember } from '@serenity-js/core/lib/stage';
import { Hash } from '@serenity-js/core/lib/stage/crew/artifact-archiver/Hash';

/**
 * @desc Stores any {@link Artifact}s emitted through {@link ArtifactGenerated} events on the {@link FileSystem}
 *
 * @access public
 */
export class JUnitArchiver implements StageCrewMember {

    static storingArtifactsAt(...destination: string[]): JUnitArchiver {
        ensure('Path to destination directory', destination, property('length', isGreaterThan(0)));
        const pathToDestination = destination.map(segment => new Path(segment)).reduce((acc, current) => acc.join(current));
        return new JUnitArchiver(new FileSystem(pathToDestination));
    }

    constructor(
        private readonly fileSystem: FileSystem,
        private readonly stage: Stage = null,
    ) {
    }

    assignedTo(stage: Stage) {
        console.log('JUnitArchiver: assignedTo');
        return new JUnitArchiver(this.fileSystem, stage);
    }

    notifyOf(event: DomainEvent): void {
        match(event)
            .when(ArtifactGenerated, (e: ArtifactGenerated) => {
                match(e.artifact)
                .when(XMLData, (xml: XMLData) => {
                    const filename = this.fileNameFor('junit', e.name, xml, 'xml');

                    this.archive(
                        filename,
                        Buffer.from(xml.base64EncodedValue, 'base64').toString(),
                        'utf8',
                        this.archivisationAnnouncement(e, filename),
                    );
                })
                .else((d: Artifact)=>{
                })
            })
            .else((e: DomainEvent) => {
                return void 0;
            })
    }

    private fileNameFor(prefix: string, artifactName: Name, artifact: Artifact, extension: string): Path {
        const hash = Hash.of(artifact.base64EncodedValue).short();
        return Path.fromSanitisedString(
            // Ensure that the file name is shorter than 250 chars, which is safe with all the filesystems
            // note: we can't do that in the Path constructor as the Path can be used to join other paths,
            // so restricting the length of the _path_ itself would not be correct.
            `${ prefix.substring(0, 10) }-${ artifactName.value.toLocaleLowerCase().substring(0, 220) }-${ hash }.${ extension }`,
            // characters:     10        1         220                                                 1    10   1    4            < 250

        );
    }

    private archive(relativePath: Path, contents: string, encoding: string, announce: (absolutePath: Path) => void): void {
        const id = CorrelationId.create();

        this.stage.announce(new AsyncOperationAttempted(
            new Description(`[${ this.constructor.name }] Saving '${ relativePath.value }'...`),
            id,
        ));

        this.fileSystem.store(relativePath, contents, encoding)
            .then(absolutePath => {
                announce(relativePath);

                this.stage.announce(new AsyncOperationCompleted(
                    new Description(`[${ this.constructor.name }] Saved '${ absolutePath.value }'`),
                    id,
                ));
            })
            .catch(error => {
                this.stage.announce(new AsyncOperationFailed(error, id));
            });
    }

    private archivisationAnnouncement(evt: ArtifactGenerated | ActivityRelatedArtifactGenerated, relativePathToArtifact: Path) {
        return (absolutePath: Path) => {
            if (evt instanceof ActivityRelatedArtifactGenerated) {
                this.stage.announce(new ActivityRelatedArtifactArchived(
                    evt.details,
                    evt.name,
                    evt.artifact.constructor as ArtifactType,
                    relativePathToArtifact,
                ));
            } else if (evt instanceof ArtifactGenerated) {
                this.stage.announce(new ArtifactArchived(
                    evt.name,
                    evt.artifact.constructor as ArtifactType,
                    relativePathToArtifact,
                ));
            }
        };
    }
}

export class XMLData extends Artifact {
    map<T>(fn: (decodedValue: Buffer) => T): T {
        return fn(Buffer.from(this.base64EncodedValue, 'base64'));
    }
  
    static fromString (value: string): XMLData {
      return new XMLData(Buffer.from(value).toString('base64'));
    }

    static fromBuffer(value: Buffer): XMLData {
        return new XMLData(value.toString('base64'));
    }
  }