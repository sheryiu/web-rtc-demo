import { isPlatformServer } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import QRCode from 'qrcode';
import { filter, map } from 'rxjs';
import { MultiplayerService } from '../core/multiplayer.service';
import { RtcManagerService } from '../core/rtc-manager.service';

@Component({
  selector: 'app-join-game',
  standalone: true,
  imports: [
  ],
  template: `
  <div class="absolute inset-0 backdrop-blur-2xl bg-black/10 flex items-center justify-center">
    <div class="flex items-center justify-center flex-col max-w-screen-md min-w-60 w-10/12 bg-white rounded-2xl p-6 gap-4 relative before:absolute before:inset-1 before:rounded-xl before:border-2 before:border-black/50 before:pointer-events-none">
      <p class="text-xl font-medium text-center">Send this code back to your friend</p>
      <p class="-my-2">Click text to copy</p>
      @if (code()) {
        <p class="truncate w-full border border-black rounded-md p-1 select-all" (click)="onCopyCode()">{{ code() }}</p>
        <div class="flex flex-row gap-4 overflow-x-auto overflow-y-hidden w-full">
          @for (segment of codeSegmentsDataUrl(); track segment) {
            <div class="flex flex-col gap-2 items-center w-64 flex-none">
              <img class="size-72" [src]="segment" alt="QR Code Segment">
              <span class="text-3xl font-bold">{{ $index + 1 }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="truncate w-full border border-black rounded-md p-1 text-stone-800">Loading...</p>
      }
    </div>
  </div>
  `
})
export class JoinGameComponent {
  private route = inject(ActivatedRoute);
  private rtcManager = inject(RtcManagerService);
  private multiplayer = inject(MultiplayerService);
  code = signal<string>('')
  codeSegmentsDataUrl = signal<string[]>([]);
  private router = inject(Router);

  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) return;
    this.route.queryParamMap.pipe(
      map(p => p.get('code')),
      filter(code => !!code),
      map(code => RtcManagerService.parseFromUrl(code!)),
      takeUntilDestroyed(),
    ).subscribe(([iceCandidates, offer]) => {
      this.rtcManager.initialize(offer).then((data) => {
        this.rtcManager.addIceCandidates(iceCandidates);
        return RtcManagerService.formatAsUrl(data);
      }).then(formatted => {
        this.code.set(formatted);
        return formatted.match(/.{1,128}/g) ?? [];
      }).then(segments => {
        return Promise.all(segments.map(segment => {
          return QRCode.toDataURL(segment)
        }))
      }).then(qrCodes => {
        this.codeSegmentsDataUrl.set(qrCodes);
      });
    })
    this.rtcManager.onChannelOpen.pipe(
      takeUntilDestroyed(),
    ).subscribe(isOpen => {
      if (isOpen) {
        this.multiplayer.startGameAsParticipant();
        this.router.navigate(['../'], { replaceUrl: true })
      }
    })
  }

  onCopyCode() {
    navigator.clipboard.writeText(this.code())
  }
}
