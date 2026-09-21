import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'hp-saved-search-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Save search</h2>
    <mat-dialog-content style="display:grid;gap:8px;min-width:360px">
      <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput [(ngModel)]="name" /></mat-form-field>
      <mat-checkbox [(ngModel)]="shared">Share with everyone</mat-checkbox>
      @if (data.name) { <mat-checkbox [(ngModel)]="update">Update "{{ data.name }}" instead of creating a new search</mat-checkbox> }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="!name.trim()" (click)="ref.close({ name: name.trim(), shared, update })">Save</button></mat-dialog-actions>
  `,
})
export class SavedSearchDialog {
  readonly ref = inject(MatDialogRef<SavedSearchDialog>); readonly data = inject<{ name: string; shared: boolean }>(MAT_DIALOG_DATA);
  name = this.data.name; shared = this.data.shared; update = !!this.data.name;
}
